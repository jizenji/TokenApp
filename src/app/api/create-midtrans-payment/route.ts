
// File: /app/api/create-midtrans-payment/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, updateDoc } from 'firebase/firestore';
import type { PendingTransaction } from '@/types';

const MIDTRANS_SNAP_API_URL_SANDBOX = 'https://app.sandbox.midtrans.com/snap/v1/transactions';
const MIDTRANS_SERVER_KEY_SANDBOX = process.env.MIDTRANS_SERVER_KEY_SANDBOX || 'SB-Mid-server-Dab1Z1yf3Z8ElwJWoGvtbE60';

interface MidtransPaymentRequestBody {
  referenceId: string;
  totalPayment: number;
  productName: string;
  productAmount: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  customerId?: string; // Business Customer ID like SAI-XXXX
  finishRedirectUrl: string;
  unfinishRedirectUrl?: string;
  errorRedirectUrl?: string;
  adminFee?: number;
  taxAmount?: number;
  otherCosts?: number;
  discountAmount?: number;
  voucherCodeUsed?: string | null;
  serviceIdForVending: string;
  tokenTypeForVending: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: MidtransPaymentRequestBody = await request.json();
    const {
      referenceId,
      totalPayment,
      productName,
      productAmount,
      buyerName,
      buyerEmail,
      buyerPhone,
      customerId, // Added customerId
      finishRedirectUrl,
      unfinishRedirectUrl,
      errorRedirectUrl,
      adminFee = 0,
      taxAmount = 0,
      otherCosts = 0,
      discountAmount = 0,
      voucherCodeUsed,
      serviceIdForVending,
      tokenTypeForVending,
    } = body;

    if (!referenceId || totalPayment === undefined || totalPayment === null || !productName || productAmount === undefined || productAmount === null || !buyerName || !buyerEmail || !buyerPhone || !finishRedirectUrl || !serviceIdForVending || !tokenTypeForVending) {
      return NextResponse.json({ message: 'Data permintaan tidak lengkap. Pastikan semua detail transaksi, pembeli, dan info vending terisi.' }, { status: 400 });
    }
    
    const numericTotalPayment = Number(totalPayment);
    if (isNaN(numericTotalPayment) || numericTotalPayment < 1000) {
        return NextResponse.json({ message: 'Total pembayaran (gross_amount) harus berupa angka positif dan minimal Rp 1.000.' }, { status: 400 });
    }
    const numericProductAmount = Number(productAmount);
     if (isNaN(numericProductAmount) || numericProductAmount <= 0) {
        return NextResponse.json({ message: 'Nominal produk (productAmount) harus positif.' }, { status: 400 });
    }

    const pendingTxData: Omit<PendingTransaction, 'id' | 'midtransToken' | 'midtransRedirectUrl' | 'updatedAt' | 'paymentDetails' | 'vendingAttempts' | 'lastVendingError' | 'generatedTokenCode'> = {
        orderId: referenceId,
        customerId: customerId || undefined, // Save customerId if provided
        serviceIdForVending,
        tokenTypeForVending,
        productAmount: numericProductAmount,
        productName,
        totalPayment: numericTotalPayment,
        buyerName,
        buyerEmail,
        buyerPhone,
        adminFee,
        taxAmount,
        otherCosts,
        discountAmount,
        voucherCodeUsed: voucherCodeUsed || null,
        status: 'pending',
        createdAt: serverTimestamp(),
    };

    try {
        const pendingTxRef = await addDoc(collection(db, 'pending_transactions'), pendingTxData);
        console.log(`[CreateMidtransPayment] Pending transaction saved with ID: ${pendingTxRef.id}, Order ID: ${referenceId}`);
    } catch (dbError: any) {
        console.error('[CreateMidtransPayment] Error saving pending transaction to Firestore:', dbError);
        return NextResponse.json({ message: 'Gagal menyimpan data transaksi awal. Pembayaran tidak dilanjutkan.', details: dbError.message }, { status: 500 });
    }

    const nameParts = buyerName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : (nameParts[0] || 'Customer');

    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:9002';
    const requestProtocol = requestHost.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${requestProtocol}://${requestHost}`;

    const itemDetails: Array<{id: string; price: number; quantity: number; name: string}> = [];
    itemDetails.push({ id: referenceId, price: numericProductAmount, quantity: 1, name: productName });
    if (adminFee > 0) itemDetails.push({ id: 'ADMIN_FEE', price: adminFee, quantity: 1, name: 'Biaya Admin' });
    if (taxAmount > 0) itemDetails.push({ id: 'TAX', price: taxAmount, quantity: 1, name: 'Pajak' });
    if (otherCosts > 0) itemDetails.push({ id: 'OTHER_COSTS', price: otherCosts, quantity: 1, name: 'Biaya Lain' });
    if (discountAmount > 0) itemDetails.push({ id: voucherCodeUsed || 'DISCOUNT', price: -discountAmount, quantity: 1, name: `Diskon${voucherCodeUsed ? ` (${voucherCodeUsed})` : ''}` });
    
    const calculatedItemTotal = itemDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (calculatedItemTotal !== numericTotalPayment) {
      console.warn(
        `[CreateMidtransPayment] Midtrans gross_amount (${numericTotalPayment}) mismatch with item_details sum (${calculatedItemTotal}). Order ID: ${referenceId}. This might cause issues. Item Details:`, 
        JSON.stringify(itemDetails)
      );
    }

    const midtransApiRequestBody: Record<string, any> = {
      transaction_details: {
        order_id: referenceId,
        gross_amount: numericTotalPayment,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email: buyerEmail,
        phone: buyerPhone,
      },
      callbacks: {
        finish: finishRedirectUrl.includes("?") ? `${finishRedirectUrl}&status=success&ref=${referenceId}` : `${finishRedirectUrl}?status=success&ref=${referenceId}`,
        unfinish: unfinishRedirectUrl ? (unfinishRedirectUrl.includes("?") ? `${unfinishRedirectUrl}&status=unfinish&ref=${referenceId}` : `${unfinishRedirectUrl}?status=unfinish&ref=${referenceId}`) : `${baseUrl}/my-tokens?status=unfinish&ref=${referenceId}`,
        error: errorRedirectUrl ? (errorRedirectUrl.includes("?") ? `${errorRedirectUrl}&status=error&ref=${referenceId}` : `${errorRedirectUrl}?status=error&ref=${referenceId}`) : `${baseUrl}/my-tokens?status=error&ref=${referenceId}`,
      },
    };
    
    const base64EncodedServerKey = Buffer.from(MIDTRANS_SERVER_KEY_SANDBOX + ':').toString('base64');
    const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${base64EncodedServerKey}`,
    };

    // console.log('Midtrans Request Headers:', JSON.stringify(requestHeaders, null, 2));
    console.log('[CreateMidtransPayment] Midtrans Request Body:', JSON.stringify(midtransApiRequestBody, null, 2));
    console.log('[CreateMidtransPayment] Target Midtrans URL:', MIDTRANS_SNAP_API_URL_SANDBOX);

    if (!MIDTRANS_SERVER_KEY_SANDBOX || MIDTRANS_SERVER_KEY_SANDBOX === 'SB-Mid-server-YourSandboxServerKey' || MIDTRANS_SERVER_KEY_SANDBOX.includes("YOUR_SERVER_KEY") || MIDTRANS_SERVER_KEY_SANDBOX === "SB-Mid-server-Dab1Z1yf3Z8ElwJWoGvtbE60") {
      console.warn('WARNING: Midtrans Server Key is using a default or placeholder value! Ensure it is correctly set in environment variables for production.');
      if (process.env.NODE_ENV === 'production' && MIDTRANS_SERVER_KEY_SANDBOX === 'SB-Mid-server-Dab1Z1yf3Z8ElwJWoGvtbE60') {
         console.error('FATAL: Default Midtrans Server Key is being used in production! Payment will likely fail or be insecure.');
      }
    }

    const midtransResponse = await fetch(MIDTRANS_SNAP_API_URL_SANDBOX, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(midtransApiRequestBody),
    });

    const responseData = await midtransResponse.json();
    console.log('[CreateMidtransPayment] Midtrans API Response:', responseData);

    if (!midtransResponse.ok) {
        const errorMessages = responseData.error_messages ? responseData.error_messages.join(', ') : (responseData.message || `Midtrans API Error: ${midtransResponse.status}`);
        return NextResponse.json({ message: errorMessages, details: responseData }, { status: midtransResponse.status });
    }

    if (responseData.token) {
        try {
            const pendingTxQuery = query(collection(db, 'pending_transactions'), where('orderId', '==', referenceId), limit(1));
            const pendingTxSnapshot = await getDocs(pendingTxQuery);
            if (!pendingTxSnapshot.empty) {
                const pendingTxDocRef = pendingTxSnapshot.docs[0].ref;
                await updateDoc(pendingTxDocRef, {
                    midtransToken: responseData.token,
                    updatedAt: serverTimestamp()
                });
                console.log(`[CreateMidtransPayment] Updated pending transaction ${referenceId} with Midtrans Snap token.`);
            }
        } catch (updateError: any) {
            console.error(`[CreateMidtransPayment] Error updating pending transaction ${referenceId} with Midtrans Snap token:`, updateError);
        }
        return NextResponse.json({ token: responseData.token }, { status: 200 });
    } else {
        console.error('[CreateMidtransPayment] Midtrans API call successful, but no Snap token in response:', responseData);
        return NextResponse.json({ message: 'Midtrans response successful but Snap token was not found.', details: responseData }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[CreateMidtransPayment] Error in /api/create-midtrans-payment route:', error);
    return NextResponse.json({ message: error.message || 'Terjadi kesalahan pada server.', details: error.toString() }, { status: 500 });
  }
}


// File: /app/api/midtrans-playground-transaction/route.ts
import { NextResponse } from 'next/server';

const MIDTRANS_SNAP_API_URL_SANDBOX = 'https://app.sandbox.midtrans.com/snap/v1/transactions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      serverKey, // Midtrans Server Key from form
      productName,
      amount,
      orderId,
      buyerName,
      buyerEmail,
      buyerPhone,
      finishRedirectUrl,
      unfinishRedirectUrl, // Optional
      errorRedirectUrl,   // Optional
      // merchantId and clientKey are received but not directly used for Snap token generation with server key auth
    } = body;

    // Basic input validation
    if (!serverKey || !productName || !amount || !orderId || !buyerName || !buyerEmail || !buyerPhone || !finishRedirectUrl) {
      return NextResponse.json({ message: 'Data permintaan tidak lengkap. Server Key, produk, jumlah, order ID, detail pembeli, dan finishRedirectUrl wajib diisi.' }, { status: 400 });
    }
    
    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount < 1000) { // Midtrans min amount usually 1000
        return NextResponse.json({ message: 'Jumlah (amount) harus berupa angka positif dan minimal 1000.' }, { status: 400 });
    }

    // Split buyerName into first_name and last_name
    const nameParts = buyerName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName;

    const midtransApiRequestBody: Record<string, any> = {
      transaction_details: {
        order_id: orderId,
        gross_amount: numericAmount,
      },
      item_details: [{
        id: orderId, // Can use orderId or a specific product ID
        price: numericAmount,
        quantity: 1,
        name: productName,
      }],
      credit_card: { // Added this section based on cURL example
        secure: true,
      },
      customer_details: {
        first_name: firstName,
        last_name: lastName,
        email: buyerEmail,
        phone: buyerPhone,
      },
      callbacks: {
        finish: finishRedirectUrl,
      }
    };

    if (unfinishRedirectUrl) {
      midtransApiRequestBody.callbacks.unfinish = unfinishRedirectUrl;
    }
    if (errorRedirectUrl) {
      // For Snap API, error redirect is usually handled on client or via `onError` callback if using snap.js directly.
      // However, some payment methods might use an error_url. For this backend-driven approach,
      // it might be better to handle errors returned by Midtrans API directly.
      // For simplicity, we'll keep it here if Midtrans documentation for direct POST to snap/v1/transactions mentions it.
      // Typically, finish_redirect_url is the most critical for Snap.
    }
    
    // Note: For production, consider enabling specific payment methods:
    // "enabled_payments": ["credit_card", "gopay", "shopeepay", "bca_va", "bni_va"]

    const base64EncodedServerKey = Buffer.from(serverKey + ':').toString('base64');
    const requestHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${base64EncodedServerKey}`,
    };

    console.log('--- Midtrans Playground Backend ---');
    console.log('Received Server Key from form:', serverKey ? '********' : 'NOT RECEIVED');
    console.log('Midtrans Request Headers (for sending):', JSON.stringify(requestHeaders, null, 2));
    console.log('Midtrans Request Body (for sending):', JSON.stringify(midtransApiRequestBody, null, 2));
    console.log('Target Midtrans URL:', MIDTRANS_SNAP_API_URL_SANDBOX);
    console.log('---------------------------------');

    const midtransResponse = await fetch(MIDTRANS_SNAP_API_URL_SANDBOX, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(midtransApiRequestBody),
    });

    const responseData = await midtransResponse.json();
    console.log('Midtrans Playground - Response from Midtrans API:', responseData);

    if (!midtransResponse.ok) {
        // Midtrans error responses usually have `error_messages` array
        const errorMessages = responseData.error_messages ? responseData.error_messages.join(', ') : (responseData.message || `Midtrans API Error: ${midtransResponse.status}`);
        return NextResponse.json({ message: errorMessages, details: responseData }, { status: midtransResponse.status });
    }

    // Expecting `token` and `redirect_url` for Snap transactions
    // The redirect_url is the Snap payment page URL
    return NextResponse.json(responseData, { status: midtransResponse.status });

  } catch (error: any) {
    console.error('Error in Midtrans Playground API route:', error);
    return NextResponse.json({ message: error.message || 'Terjadi kesalahan pada server.', details: error.toString() }, { status: 500 });
  }
}

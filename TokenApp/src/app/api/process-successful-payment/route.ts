
// File: /app/api/process-successful-payment/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit, updateDoc, serverTimestamp, addDoc, doc, getDoc as getFirestoreDoc } from 'firebase/firestore';
import type { PendingTransaction, AllTokenSettings, GeneratedToken, CustomerService, CustomerData } from '@/types';

const TOKEN_TYPES_FOR_SETTINGS_FETCH = ['ELECTRICITY', 'WATER', 'GAS', 'SOLAR'];

async function fetchAllTokenSettingsFromDb(): Promise<AllTokenSettings> {
    const loadedSettings: AllTokenSettings = {};
    try {
      for (const tokenName of TOKEN_TYPES_FOR_SETTINGS_FETCH) {
        const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);
        const settingsDocSnap = await getFirestoreDoc(settingsDocRef);
        if (settingsDocSnap.exists()) {
          const data = settingsDocSnap.data();
          loadedSettings[tokenName] = (data?.settings?.[tokenName]) || {};
        } else {
            loadedSettings[tokenName] = {}; 
        }
      }
      return loadedSettings;
    } catch (err) {
      console.error("[ProcessSuccessfulPayment API] Error fetching all token settings:", err);
      return loadedSettings; 
    }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    console.log(`[ProcessPayment] Received request for orderId: ${orderId}`);

    const pendingTxQuery = query(collection(db, 'pending_transactions'), where('orderId', '==', orderId), limit(1));
    const pendingTxSnapshot = await getDocs(pendingTxQuery);

    if (pendingTxSnapshot.empty) {
      console.error(`[ProcessPayment] Pending transaction not found for orderId: ${orderId}`);
      return NextResponse.json({ success: false, message: 'Transaksi pending tidak ditemukan.' }, { status: 404 });
    }

    const pendingTxDoc = pendingTxSnapshot.docs[0];
    const pendingTxData = pendingTxDoc.data() as PendingTransaction;
    const pendingTxDocRef = pendingTxDoc.ref;

    if (pendingTxData.status === 'completed_vending' && pendingTxData.generatedTokenCode) {
      console.log(`[ProcessPayment] OrderId ${orderId} already vended. Token: ${pendingTxData.generatedTokenCode}`);
      return NextResponse.json({ success: true, token: pendingTxData.generatedTokenCode, message: 'Token sudah pernah di-generate.' });
    }
    
    if (pendingTxData.status !== 'pending' && pendingTxData.status !== 'paid') {
        if (pendingTxData.status !== 'failed_vending') {
            console.warn(`[ProcessPayment] OrderId ${orderId} has status ${pendingTxData.status}, not eligible for new vending attempt unless failed_vending.`);
            return NextResponse.json({ success: false, message: `Transaksi dengan status ${pendingTxData.status} tidak dapat diproses ulang saat ini.` }, { status: 400 });
        }
    }

    await updateDoc(pendingTxDocRef, {
      status: 'paid', 
      paymentDetails: { midtransConfirmationTime: serverTimestamp() }, 
      updatedAt: serverTimestamp(),
    });
    console.log(`[ProcessPayment] Marked orderId ${orderId} as 'paid'.`);

    const { 
      serviceIdForVending, 
      productAmount: nominalTokenAmount, // This is the token's nominal value
      tokenTypeForVending, 
      customerId: businessCustomerId, 
      buyerName,
      totalPayment: actualTotalPaid, // This is the final amount paid by customer
      adminFee,
      taxAmount,
      otherCosts,
      discountAmount,
      voucherCodeUsed,
      originalTotalBeforeDiscount
    } = pendingTxData;

    if (!serviceIdForVending || nominalTokenAmount === undefined || nominalTokenAmount === null || !tokenTypeForVending) {
      console.error(`[ProcessPayment] Missing serviceIdForVending, productAmount or tokenTypeForVending for orderId: ${orderId}`);
      await updateDoc(pendingTxDocRef, { status: 'failed_vending', lastVendingError: 'Data vending tidak lengkap (serviceId, amount, or type).', updatedAt: serverTimestamp() });
      return NextResponse.json({ success: false, message: 'Data internal untuk vending tidak lengkap.' }, { status: 500 });
    }
    
    console.log(`[ProcessPayment] Attempting to vend token for serviceId: ${serviceIdForVending}, nominalAmount: ${nominalTokenAmount}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
    const vendTokenUrl = `${baseUrl}/api/vend-stronpower-token`;
    console.log(`[ProcessPayment] Calling internal vending API: ${vendTokenUrl}`);

    const vendTokenResponse = await fetch(vendTokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meterId: serviceIdForVending, amount: nominalTokenAmount }),
    });

    const vendTokenResponseText = await vendTokenResponse.text();
    console.log(`[ProcessPayment] Raw response text from ${vendTokenUrl}:`, vendTokenResponseText.substring(0, 500)); 

    let vendTokenData;
    try {
        vendTokenData = JSON.parse(vendTokenResponseText);
    } catch (e) {
        console.error(`[ProcessPayment] Failed to parse response from ${vendTokenUrl} as JSON. Status: ${vendTokenResponse.status}. Error:`, e);
        console.error(`[ProcessPayment] Full response text from ${vendTokenUrl} (if error occurred):`, vendTokenResponseText);
        await updateDoc(pendingTxDocRef, {
            status: 'failed_vending',
            lastVendingError: `Internal API error: Vending service returned non-JSON response (Status: ${vendTokenResponse.status}).`,
            vendingAttempts: (pendingTxData.vendingAttempts || 0) + 1,
            updatedAt: serverTimestamp(),
        });
        return NextResponse.json({ success: false, message: `Gagal memproses token: Layanan vending internal bermasalah (Status: ${vendTokenResponse.status}). Cek log server.` }, { status: 500 });
    }
    
    console.log(`[ProcessPayment] Parsed JSON response from /api/vend-stronpower-token:`, vendTokenData);

    if (vendTokenResponse.ok && vendTokenData.success && vendTokenData.token) {
      const generatedToken = vendTokenData.token;
      await updateDoc(pendingTxDocRef, {
        status: 'completed_vending',
        generatedTokenCode: generatedToken,
        vendingAttempts: (pendingTxData.vendingAttempts || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      console.log(`[ProcessPayment] Vending successful for orderId ${orderId}. Token: ${generatedToken}`);
      
      try {
        const allTokenSettings = await fetchAllTokenSettingsFromDb();
        let basePrice: number | undefined;
        let unitValue: string | undefined;
        let serviceDetails: CustomerService | undefined;

        if (businessCustomerId) {
          const customersCollectionRef = collection(db, 'customers');
          const customerQuery = query(customersCollectionRef, where("customerId", "==", businessCustomerId), limit(1));
          const customerSnapshot = await getDocs(customerQuery);

          if (!customerSnapshot.empty) {
            const customerDoc = customerSnapshot.docs[0];
            const customerData = customerDoc.data() as CustomerData; 
            serviceDetails = customerData.services?.find(s => s.serviceId === serviceIdForVending && s.tokenType.toUpperCase() === tokenTypeForVending.toUpperCase());
          } else {
            console.warn(`[ProcessPayment] Customer with business ID ${businessCustomerId} not found for enrichment.`);
          }
        }
        
        if (serviceDetails && allTokenSettings) {
            const settingsKey = serviceDetails.tokenType.toUpperCase();
            const areaKey = serviceDetails.areaProject;
            const projectKey = serviceDetails.project;
            const vendorKey = serviceDetails.vendorName;

            const basePriceStr = allTokenSettings[settingsKey]?.[areaKey]?.[projectKey]?.[vendorKey]?.basePrice;
            if (basePriceStr) {
              basePrice = parseInt(basePriceStr.replace(/\D/g, ''), 10);
              if (!isNaN(basePrice) && basePrice > 0 && nominalTokenAmount) { 
                const rawUnitValue = nominalTokenAmount / basePrice;
                unitValue = rawUnitValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              }
            }
        }

        const generatedTokenEntry: Omit<GeneratedToken, 'id'> = {
          orderId: orderId,
          customerId: businessCustomerId || 'UNKNOWN_CUSTOMER_ID', 
          customerName: buyerName, 
          serviceId: serviceIdForVending,
          type: tokenTypeForVending.toLowerCase(),
          amount: nominalTokenAmount, // Nominal token value
          generatedTokenCode: generatedToken,
          createdAt: new Date(), 
          basePrice: basePrice || 0,
          unitValue: unitValue || '0.00',
          // Purchase summary fields with default values for undefined fields
          adminFee: adminFee || 0,
          taxAmount: taxAmount || 0,
          otherCosts: otherCosts || 0,
          discountAmount: discountAmount || 0,
          voucherCodeUsed: voucherCodeUsed || null,
          originalTotalBeforeDiscount: originalTotalBeforeDiscount || 0,
          actualTotalPayment: actualTotalPaid || 0,
        };
        await addDoc(collection(db, 'generated_tokens'), generatedTokenEntry);
        console.log(`[ProcessPayment] Successfully added vended token to generated_tokens for orderId: ${orderId}`);
      } catch (dbError) {
        console.error(`[ProcessPayment] Error saving token to generated_tokens for orderId ${orderId}:`, dbError);
      }

      return NextResponse.json({ success: true, token: generatedToken, message: 'Token berhasil di-generate.' });
    } else {
      const vendingError = vendTokenData.message || 'Gagal melakukan vending token dari API Stronpower.';
      await updateDoc(pendingTxDocRef, {
        status: 'failed_vending',
        lastVendingError: vendingError,
        vendingAttempts: (pendingTxData.vendingAttempts || 0) + 1,
        updatedAt: serverTimestamp(),
      });
      console.error(`[ProcessPayment] Vending failed for orderId ${orderId}. Error: ${vendingError}`);
      return NextResponse.json({ success: false, message: `Pembayaran berhasil, tapi gagal generate token: ${vendingError}` }, { status: 200 }); 
    }

  } catch (error: any) {
    console.error('[ProcessPayment] General error in /api/process-successful-payment:', error);
    try {
        const bodyForError = await request.json().catch(() => ({})); 
        const orderIdForError = bodyForError.orderId;
        if (orderIdForError) {
            const pendingTxQuery = query(collection(db, 'pending_transactions'), where('orderId', '==', orderIdForError), limit(1));
            const pendingTxSnapshot = await getDocs(pendingTxQuery);
            if (!pendingTxSnapshot.empty) {
                const pendingTxDocRef = pendingTxSnapshot.docs[0].ref;
                await updateDoc(pendingTxDocRef, {
                    status: 'failed_vending',
                    lastVendingError: `Server error during processing: ${error.message || 'Unknown error'}`,
                    updatedAt: serverTimestamp(),
                });
            }
        }
    } catch (dbUpdateError) {
        console.error('[ProcessPayment] Failed to update pending_transaction on general error:', dbUpdateError);
    }
    return NextResponse.json({ success: false, message: error.message || 'Terjadi kesalahan pada server saat memproses pembayaran.' }, { status: 500 });
  }
}

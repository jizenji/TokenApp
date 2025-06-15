
// File: /app/api/ipaymu-playground-transaction/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// URL iPaymu Sandbox untuk direct payment API (pastikan ini adalah URL yang benar dari dokumentasi iPaymu)
const IPAYMU_API_URL_SANDBOX = 'https://sandbox.ipaymu.com/api/v2/payment';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      va,               // VA iPaymu dari form
      apiKey,           // API Key iPaymu dari form (HANYA UNTUK PLAYGROUND INI)
      productName,
      amount,           // Ini adalah harga produk yang dikirim dari form
      referenceId,
      buyerName,
      buyerEmail,
      buyerPhone,
      notifyUrl,
      returnUrl,
      cancelUrl,
    } = body;

    // Validasi input dasar
    if (!va || !apiKey || !productName || !amount || !referenceId || !buyerName || !buyerEmail || !buyerPhone) {
      return NextResponse.json({ Message: 'Data permintaan tidak lengkap. Semua field wajib diisi (kecuali URL opsional).' }, { status: 400 });
    }
    
    const numericAmount = parseInt(amount, 10);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        return NextResponse.json({ Message: 'Jumlah (amount) harus berupa angka positif.' }, { status: 400 });
    }


    // Body request untuk iPaymu API (sesuaikan dengan dokumentasi iPaymu v2 Direct Payment)
    const ipaymuApiRequestBody = {
      product: [productName], // Nama produk harus dalam array
      qty: [1],               // Kuantitas produk harus dalam array
      price: [numericAmount],   // Harga satuan produk harus dalam array
      amount: numericAmount,    // Total harga (jika hanya 1 produk, sama dengan price[0])
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/ipaymu-playground/success`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/ipaymu-playground/cancel`,
      notifyUrl: notifyUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/api/ipaymu-notify-test`,
      referenceId: referenceId, // ID unik transaksi dari sisi merchant
      buyerName: buyerName,
      buyerEmail: buyerEmail,
      buyerPhone: buyerPhone,
      // paymentMethod: "va", // Bisa dikosongkan agar user memilih di halaman iPaymu, atau tentukan (va, cstore, qris etc)
      // paymentChannel: "bca", // Jika paymentMethod VA, bisa tentukan channelnya
      feeDirection: 'MERCHANT' // Siapa yang menanggung biaya transaksi (MERCHANT atau CUSTOMER)
    };

    const bodyStringForSignature = JSON.stringify(ipaymuApiRequestBody);
    const stringToSign = `POST:${va}:${bodyStringForSignature}:${apiKey}`;
    const signature = crypto.createHmac('sha256', apiKey).update(stringToSign).digest('hex');
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:mm:ss

    console.log('iPaymu Playground - Request to iPaymu:');
    console.log('URL:', IPAYMU_API_URL_SANDBOX);
    console.log('Headers:', {
        'Content-Type': 'application/json',
        'va': va,
        'signature': signature,
        'timestamp': timestamp
    });
    console.log('Body:', bodyStringForSignature);
    console.log('StringToSign:', stringToSign);


    const iPaymuResponse = await fetch(IPAYMU_API_URL_SANDBOX, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'va': va,
        'signature': signature,
        'timestamp': timestamp,
      },
      body: bodyStringForSignature,
    });

    const responseData = await iPaymuResponse.json();
    console.log('iPaymu Playground - Response from iPaymu:', responseData);

    // Tidak perlu menyimpan transaksi ke DB untuk playground ini, hanya return response

    return NextResponse.json(responseData, { status: iPaymuResponse.status });

  } catch (error: any) {
    console.error('Error in iPaymu Playground API route:', error);
    return NextResponse.json({ Message: error.message || 'Terjadi kesalahan pada server.', Details: error.toString() }, { status: 500 });
  }
}

// Handler untuk method OPTIONS jika diperlukan (misalnya untuk CORS jika API dipanggil dari domain berbeda,
// tapi untuk API route Next.js yang dipanggil dari app sendiri biasanya tidak perlu eksplisit)
// export async function OPTIONS() {
//   return new Response(null, {
//     status: 204,
//     headers: {
//       'Access-Control-Allow-Origin': '*', // Sesuaikan dengan domain Anda
//       'Access-Control-Allow-Methods': 'POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, va, signature, timestamp',
//     },
//   });
// }


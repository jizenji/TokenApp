
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function MidtransSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Log raw searchParams as soon as useEffect runs
    console.log('[MidtransSuccessPage] Raw searchParams received from Midtrans:', searchParams.toString());

    const orderId = searchParams.get('order_id');
    const statusCode = searchParams.get('status_code');
    const transactionStatus = searchParams.get('transaction_status');
    // Midtrans might also send transaction_id, payment_type, fraud_status etc.
    // For now, we'll stick to the main ones.

    // Ensure we have at least order_id or status_code to confirm params are somewhat loaded
    if (!orderId && !statusCode) {
        console.warn('[MidtransSuccessPage] order_id and statusCode not found in params. This might be an issue or params not fully loaded yet.');
        // Decide if we should return or attempt redirect with what we have
        // For now, let's proceed, but this log is important for debugging.
    }
    
    const redirectUrl = new URL(ROUTES.MIDTRANS_PLAYGROUND, window.location.origin);
    redirectUrl.searchParams.set('result_type', 'success');
    if (orderId) redirectUrl.searchParams.set('order_id', orderId);
    if (statusCode) redirectUrl.searchParams.set('status_code', statusCode);
    if (transactionStatus) redirectUrl.searchParams.set('transaction_status', transactionStatus);
    
    // You can add more params if needed, e.g.,
    // const transactionId = searchParams.get('transaction_id');
    // if (transactionId) redirectUrl.searchParams.set('transaction_id', transactionId);
    
    console.log('[MidtransSuccessPage] Attempting to redirect to (main playground):', redirectUrl.toString());
    router.replace(redirectUrl.toString());
    
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold text-foreground mb-2">Processing Payment Success...</h1>
      <p className="text-muted-foreground">
        Please wait, you are being redirected.
      </p>
      <p className="text-sm text-muted-foreground mt-6">
        If you are not redirected automatically, please <Link href={ROUTES.MIDTRANS_PLAYGROUND} className="underline text-primary hover:text-primary/80">click here</Link>.
      </p>
    </div>
  );
}

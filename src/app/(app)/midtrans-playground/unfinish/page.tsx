
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function MidtransUnfinishPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    console.log('[MidtransUnfinishPage] Raw searchParams received from Midtrans:', searchParams.toString());

    const orderId = searchParams.get('order_id');
    const statusCode = searchParams.get('status_code');
    const transactionStatus = searchParams.get('transaction_status');

    if (!orderId && !statusCode) {
        console.warn('[MidtransUnfinishPage] order_id and statusCode not found in params.');
    }
    
    const redirectUrl = new URL(ROUTES.MIDTRANS_PLAYGROUND, window.location.origin);
    redirectUrl.searchParams.set('result_type', 'unfinish');
    if (orderId) redirectUrl.searchParams.set('order_id', orderId);
    if (statusCode) redirectUrl.searchParams.set('status_code', statusCode);
    if (transactionStatus) redirectUrl.searchParams.set('transaction_status', transactionStatus);
    
    console.log('[MidtransUnfinishPage] Attempting to redirect to (main playground):', redirectUrl.toString());
    router.replace(redirectUrl.toString());
    
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mb-6" />
      <h1 className="text-2xl font-semibold text-foreground mb-2">Processing Unfinished Payment...</h1>
      <p className="text-muted-foreground">
        Please wait, you are being redirected.
      </p>
      <p className="text-sm text-muted-foreground mt-6">
        If you are not redirected automatically, please <Link href={ROUTES.MIDTRANS_PLAYGROUND} className="underline text-primary hover:text-primary/80">click here</Link>.
      </p>
    </div>
  );
}

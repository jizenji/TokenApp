
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Send, FileJson, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';

interface PlaygroundFormState {
  merchantId: string;
  clientKey: string;
  serverKey: string;
  productName: string;
  amount: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  finishRedirectUrl: string;
  unfinishRedirectUrl: string;
  errorRedirectUrl: string;
}

interface TransactionResult {
  type: 'success' | 'unfinish' | 'error';
  order_id?: string | null;
  status_code?: string | null;
  transaction_status?: string | null;
  message?: string | null;
}

const generateOrderId = (productName: string, amount: string, merchantIdSuffix: string): string => {
  const safeProductName = productName.replace(/\s+/g, '_').substring(0, 10).toUpperCase();
  const safeMerchantSuffix = merchantIdSuffix.length > 5 ? merchantIdSuffix.slice(-5) : merchantIdSuffix.padEnd(5,'X');
  const timestampSuffix = Date.now().toString().slice(-6);
  return `PLAY-${safeProductName}-${amount}-${safeMerchantSuffix}-${timestampSuffix}`;
};

const initialFormState: PlaygroundFormState = {
  merchantId: 'G806518017',
  clientKey: 'SB-Mid-client-eQDHZLmaU2d6vCLZ',
  serverKey: 'SB-Mid-server-Dab1Z1yf3Z8ElwJWoGvtbE60',
  productName: 'Test Token Listrik',
  amount: '50000',
  orderId: generateOrderId('Test Token Listrik', '50000', 'G806518017'),
  buyerName: 'Budi Midtrans',
  buyerEmail: 'budi.midtrans@example.com',
  buyerPhone: '081234560000',
  finishRedirectUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/midtrans-playground/success`,
  unfinishRedirectUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/midtrans-playground/unfinish`,
  errorRedirectUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/midtrans-playground/error`,
};

export default function MidtransPlaygroundPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<PlaygroundFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState<object | null>(null);
  const [responseReceived, setResponseReceived] = useState<object | string | null>(null);
  const [responseStatus, setResponseStatus] = useState<'success' | 'error' | null>(null);
  const [lastTransactionResult, setLastTransactionResult] = useState<TransactionResult | null>(null);

  useEffect(() => {
    const resultType = searchParams.get('result_type') as TransactionResult['type'] | null;
    const orderIdParam = searchParams.get('order_id');
    const statusCodeParam = searchParams.get('status_code');
    const transactionStatusParam = searchParams.get('transaction_status');
    const messageParam = searchParams.get('message');

    if (resultType) {
      console.log('[MidtransPlayground] Processing redirect params:', {
        resultType, orderIdParam, statusCodeParam, transactionStatusParam, messageParam
      });

      const resultDetails: TransactionResult = {
        type: resultType,
        order_id: orderIdParam,
        status_code: statusCodeParam,
        transaction_status: transactionStatusParam,
        message: messageParam,
      };
      setLastTransactionResult(resultDetails);

      // Clear query parameters from URL after processing
      const currentPath = window.location.pathname;
      router.replace(currentPath, { scroll: false });
    }
  }, [searchParams, router]); // Removed toast from dependency array

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newState = { ...prev, [name]: value };
      if (name === 'productName' || name === 'amount' || name === 'merchantId') {
        newState.orderId = generateOrderId(newState.productName, newState.amount, newState.merchantId);
      }
      if (name === 'serverKey' || name === 'clientKey' || name === 'merchantId') {
           newState.orderId = generateOrderId(newState.productName, newState.amount, newState.merchantId);
      }
      return newState;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setRequestSent(null);
    setResponseReceived(null);
    setResponseStatus(null);
    setLastTransactionResult(null); 

    const payload = { ...formData };
    setRequestSent(payload);

    try {
      const res = await fetch('/api/midtrans-playground-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });

      const responseText = await res.text();
      console.log("Raw response from /api/midtrans-playground-transaction:", responseText);

      try {
        const responseData = JSON.parse(responseText);
        setResponseReceived(responseData);

        if (res.ok && responseData.redirect_url) {
          setResponseStatus('success');
          toast({
            title: 'Transaksi Midtrans Berhasil Dibuat (Sandbox)',
            description: `Anda akan diarahkan ke halaman pembayaran Midtrans...`,
            duration: 3000,
          });
          window.location.href = responseData.redirect_url;
        } else {
          setResponseStatus('error');
          toast({
            title: 'Gagal Membuat Transaksi Midtrans (Sandbox)',
            description: responseData.error_messages ? responseData.error_messages.join(', ') : (responseData.message || 'Terjadi kesalahan. Cek response untuk detail.'),
            variant: 'destructive',
            duration: 7000,
          });
        }
      } catch (parseError: any) {
        console.error('Failed to parse JSON response from backend:', parseError);
        setResponseReceived({
          error: 'Failed to parse JSON response from backend.',
          details: `Raw Response Text: ${responseText || '(empty response)'}`,
          originalError: parseError.message,
        });
        setResponseStatus('error');
        toast({
          title: 'Error: Invalid Server Response',
          description: 'The server sent a response that could not be understood. Check console for details.',
          variant: 'destructive',
        });
      }
    } catch (error: any) { 
      setResponseStatus('error');
      setResponseReceived({ error: `Network or fetch error: ${error.message}`, details: error.toString() });
      toast({
        title: 'Error Memanggil API Playground',
        description: error.message || 'Gagal menghubungi backend.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getStatusDisplay = () => {
    if (!lastTransactionResult) {
      console.log('[MidtransPlayground] getStatusDisplay: lastTransactionResult is null, not rendering status.');
      return null;
    }
    console.log('[MidtransPlayground] getStatusDisplay: Rendering status for', lastTransactionResult);

    let title = '';
    let IconComponent = CheckCircle2;
    let cardClasses = 'border-green-500/50 bg-green-50/50 dark:bg-green-900/20';
    let titleClasses = 'text-green-700 dark:text-green-400';
    let description = '';

    switch (lastTransactionResult.type) {
      case 'success':
        title = 'Pembayaran Berhasil (Sandbox)';
        description = lastTransactionResult.message || `Transaksi untuk Order ID ${lastTransactionResult.order_id || 'N/A'} telah berhasil diproses atau disimulasikan sebagai berhasil.`;
        IconComponent = CheckCircle2;
        break;
      case 'unfinish':
        title = 'Pembayaran Belum Selesai (Sandbox)';
        IconComponent = AlertCircle;
        cardClasses = 'border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/20';
        titleClasses = 'text-yellow-700 dark:text-yellow-400';
        description = lastTransactionResult.message || `Anda kembali dari halaman pembayaran Midtrans sebelum transaksi (Order ID: ${lastTransactionResult.order_id || 'N/A'}) selesai.`;
        break;
      case 'error':
        title = 'Terjadi Kesalahan Pembayaran (Sandbox)';
        IconComponent = XCircle;
        cardClasses = 'border-red-500/50 bg-red-50/50 dark:bg-red-900/20';
        titleClasses = 'text-red-700 dark:text-red-400';
        description = lastTransactionResult.message || `Terjadi kesalahan selama proses pembayaran untuk Order ID ${lastTransactionResult.order_id || 'N/A'}.`;
        break;
    }

    return (
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-lg font-semibold mb-3 text-foreground">Status Transaksi Terakhir:</h3>
        <Card className={cn("shadow-md", cardClasses)}>
          <CardHeader>
            <div className="flex items-center">
              <IconComponent className={cn("h-6 w-6 mr-2", titleClasses)} />
              <CardTitle className={cn("text-xl", titleClasses)}>{title}</CardTitle>
            </div>
            {lastTransactionResult.order_id && (
                 <CardDescription className="text-xs pt-1">
                    Order ID: {lastTransactionResult.order_id}
                 </CardDescription>
            )}
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">{description}</p>
            {lastTransactionResult.status_code && (
              <p className="text-xs mt-1">Status Code: <span className="font-mono">{lastTransactionResult.status_code}</span></p>
            )}
            {lastTransactionResult.transaction_status && (
              <p className="text-xs mt-1">Transaction Status: <span className="font-mono">{lastTransactionResult.transaction_status}</span></p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-1">
            <CreditCard className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Midtrans API Playground (Sandbox)</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Uji coba request ke API Midtrans Sandbox. Masukkan kredensial sandbox Anda. Server Key akan dikirim ke backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="merchantId">Midtrans Merchant ID</Label>
                <Input id="merchantId" name="merchantId" value={formData.merchantId} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientKey">Midtrans Client Key (Sandbox)</Label>
                <Input id="clientKey" name="clientKey" value={formData.clientKey} onChange={handleInputChange} required />
                <p className="text-xs text-muted-foreground">Client Key umumnya untuk frontend (Snap.js).</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serverKey">Midtrans Server Key (Sandbox)</Label>
                <Input id="serverKey" name="serverKey" value={formData.serverKey} onChange={handleInputChange} required />
                <p className="text-xs text-muted-foreground">Server Key ini akan dikirim ke backend Anda.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="productName">Nama Produk</Label>
                <Input id="productName" name="productName" value={formData.productName} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Jumlah (Harga Produk)</Label>
                <Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleInputChange} required min="1000" />
                 <p className="text-xs text-muted-foreground">Minimal Rp 1.000 untuk Midtrans.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID (ID Referensi)</Label>
              <Input id="orderId" name="orderId" value={formData.orderId} onChange={handleInputChange} required />
               <p className="text-xs text-muted-foreground">Otomatis di-generate, atau bisa diisi manual untuk pengujian.</p>
            </div>

            <h3 className="text-lg font-semibold pt-4 border-t mt-6">Detail Pembeli</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="buyerName">Nama Pembeli (Lengkap)</Label>
                <Input id="buyerName" name="buyerName" value={formData.buyerName} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerEmail">Email Pembeli</Label>
                <Input id="buyerEmail" name="buyerEmail" type="email" value={formData.buyerEmail} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyerPhone">Telepon Pembeli</Label>
                <Input id="buyerPhone" name="buyerPhone" value={formData.buyerPhone} onChange={handleInputChange} required />
              </div>
            </div>

            <h3 className="text-lg font-semibold pt-4 border-t mt-6">URL Konfigurasi Redirect</h3>
             <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="finishRedirectUrl">Finish Redirect URL</Label>
                    <Input id="finishRedirectUrl" name="finishRedirectUrl" value={formData.finishRedirectUrl} onChange={handleInputChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="unfinishRedirectUrl">Unfinish Redirect URL (Opsional)</Label>
                    <Input id="unfinishRedirectUrl" name="unfinishRedirectUrl" value={formData.unfinishRedirectUrl} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="errorRedirectUrl">Error Redirect URL (Opsional)</Label>
                    <Input id="errorRedirectUrl" name="errorRedirectUrl" value={formData.errorRedirectUrl} onChange={handleInputChange} />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">Notify URL (webhook) utama biasanya dikonfigurasi di dashboard Midtrans (MAP).</p>


            <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Buat Transaksi Midtrans (Sandbox)
            </Button>
          </form>

          {getStatusDisplay()}

          {(requestSent || responseReceived) && (
            <div className={cn("space-y-6", lastTransactionResult ? "mt-8 pt-6 border-t" : "mt-8 pt-6 border-t")}>
              {requestSent && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center"><FileJson className="mr-2 h-5 w-5 text-blue-500" />Request Body (Dikirim ke Backend /api/midtrans-playground-transaction)</h3>
                  <ScrollArea className="h-40 w-full rounded-md border bg-muted p-3">
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {JSON.stringify(requestSent, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              {responseReceived && (
                <div>
                  <h3 className={cn(
                    "text-lg font-semibold mb-2 flex items-center",
                    responseStatus === 'success' && "text-green-600",
                    responseStatus === 'error' && "text-red-600"
                  )}>
                    <FileJson className="mr-2 h-5 w-5" />
                    Response (Diterima dari Midtrans via Backend Anda)
                  </h3>
                  <ScrollArea className="h-60 w-full rounded-md border bg-muted p-3">
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {typeof responseReceived === 'string' ? responseReceived : JSON.stringify(responseReceived, null, 2)}
                    </pre>
                  </ScrollArea>
                  {responseStatus === 'success' && (responseReceived as any)?.redirect_url && (
                    <div className="mt-3">
                        <Button variant="outline" asChild>
                            <a href={(responseReceived as any).redirect_url} target="_blank" rel="noopener noreferrer">
                                Buka Halaman Pembayaran Midtrans (Jika diarahkan)
                            </a>
                        </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Catatan Penting</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>1. Halaman ini adalah untuk <strong className="text-destructive">latihan dan debugging</strong> integrasi API Midtrans Sandbox.</p>
            <p>2. **Server Key Sandbox** yang Anda masukkan di form ini akan dikirim ke backend API route (`/api/midtrans-playground-transaction`) untuk membuat request ke Midtrans. **Ini tidak aman untuk produksi!** Di produksi, Server Key rahasia harus disimpan aman di server.</p>
            <p>3. Pastikan URL API Midtrans Sandbox dan metode autentikasi (Basic Auth dengan Server Key) di file `/app/api/midtrans-playground-transaction/route.ts` sudah sesuai dengan dokumentasi terbaru Midtrans.</p>
            <p>4. Untuk transaksi berhasil dan redirect ke halaman pembayaran Midtrans, Midtrans Sandbox harus mengenali Server Key Anda dan request body yang dikirim.</p>
            <p>5. Jika terjadi error "Access denied due to unauthorized transaction", periksa kembali **Sandbox Server Key** Anda di dashboard Midtrans dan pastikan tidak ada typo.</p>
            <p>6. Jika Anda mendapatkan error "Unexpected end of JSON input" atau response tidak valid di browser, cek **konsol browser** dan **terminal backend** Anda untuk melihat log `Raw response...`.</p>
        </CardContent>
      </Card>
    </div>
  );
}


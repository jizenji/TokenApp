
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CreditCard, Send, FileJson } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface PlaygroundFormState {
  va: string;
  apiKey: string;
  productName: string;
  amount: string;
  referenceId: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  notifyUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

const generateReferenceId = (productName: string, amount: string, va: string): string => {
  const safeProductName = productName.replace(/\s+/g, '_').substring(0, 15).toUpperCase();
  const safeVaSuffix = va.length > 4 ? va.slice(-4) : va.padEnd(4,'X');
  const timestampSuffix = Date.now().toString().slice(-5);
  return `PLAY-${safeProductName}-${amount}-${safeVaSuffix}-${timestampSuffix}`;
}

const initialFormState: PlaygroundFormState = {
  va: '0000005720505555', // Default Sandbox VA
  apiKey: 'SANDBOX9A39CB4E-A455-4DF3-BDC3-18B94F82E28E-20211229102112', // Default Sandbox API Key
  productName: 'Test Token Listrik',
  amount: '50000',
  referenceId: generateReferenceId('Test Token Listrik', '50000', '0000005720505555'),
  buyerName: 'Budi Playground',
  buyerEmail: 'budi.playground@example.com',
  buyerPhone: '081234567890',
  notifyUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/api/ipaymu-notify-test`,
  returnUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/ipaymu-playground/success`,
  cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:9002'}/ipaymu-playground/cancel`,
};

export default function IPaymuPlaygroundPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<PlaygroundFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState<object | null>(null);
  const [responseReceived, setResponseReceived] = useState<object | string | null>(null);
  const [responseStatus, setResponseStatus] = useState<'success' | 'error' | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const newState = { ...prev, [name]: value };
      if (name === 'productName' || name === 'amount' || name === 'va') {
        newState.referenceId = generateReferenceId(newState.productName, newState.amount, newState.va);
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

    const payload = {
      ...formData,
      price: [formData.amount], 
      product: [formData.productName], 
      qty: [1],
    };
    
    setRequestSent(payload);

    try {
      const res = await fetch('/api/ipaymu-playground-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), 
      });

      const responseText = await res.text();
      console.log("Raw response from /api/ipaymu-playground-transaction:", responseText);

      try {
        const responseData = JSON.parse(responseText);
        setResponseReceived(responseData);

        if (res.ok && responseData.Status === 200 && responseData.Data?.Url) {
          setResponseStatus('success');
          toast({
            title: 'Transaksi iPaymu Berhasil Dibuat (Sandbox)',
            description: `URL Pembayaran: ${responseData.Data.Url}. Anda akan diarahkan...`,
            duration: 5000,
          });
          window.location.href = responseData.Data.Url;
        } else {
          setResponseStatus('error');
          toast({
            title: 'Gagal Membuat Transaksi iPaymu (Sandbox)',
            description: responseData.Message || 'Terjadi kesalahan. Cek response untuk detail.',
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
    } catch (error: any) { // Handles network errors or if fetch itself throws
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

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-1">
            <CreditCard className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">iPaymu API Playground (Sandbox)</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Uji coba request ke API iPaymu Sandbox. Masukkan kredensial sandbox Anda (VA & API Key akan dikirim ke backend).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="va">iPaymu VA (Sandbox)</Label>
                <Input id="va" name="va" value={formData.va} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">iPaymu API Key (Sandbox)</Label>
                <Input id="apiKey" name="apiKey" value={formData.apiKey} onChange={handleInputChange} required />
                <p className="text-xs text-muted-foreground">API Key ini akan dikirim ke backend Anda (hanya untuk playground ini).</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="productName">Nama Produk</Label>
                <Input id="productName" name="productName" value={formData.productName} onChange={handleInputChange} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Jumlah (Harga Produk)</Label>
                <Input id="amount" name="amount" type="number" value={formData.amount} onChange={handleInputChange} required min="10000" />
                 <p className="text-xs text-muted-foreground">Minimal Rp 10.000 untuk iPaymu.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="referenceId">ID Referensi (Order ID)</Label>
              <Input id="referenceId" name="referenceId" value={formData.referenceId} onChange={handleInputChange} required />
               <p className="text-xs text-muted-foreground">Otomatis di-generate, atau bisa diisi manual untuk pengujian.</p>
            </div>

            <h3 className="text-lg font-semibold pt-4 border-t mt-6">Detail Pembeli</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="buyerName">Nama Pembeli</Label>
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

            <h3 className="text-lg font-semibold pt-4 border-t mt-6">URL Konfigurasi</h3>
             <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="returnUrl">Return URL</Label>
                    <Input id="returnUrl" name="returnUrl" value={formData.returnUrl} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="notifyUrl">Notify URL (Webhook)</Label>
                    <Input id="notifyUrl" name="notifyUrl" value={formData.notifyUrl} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cancelUrl">Cancel URL</Label>
                    <Input id="cancelUrl" name="cancelUrl" value={formData.cancelUrl} onChange={handleInputChange} />
                </div>
            </div>

            <Button type="submit" className="w-full md:w-auto" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Buat Transaksi (Sandbox)
            </Button>
          </form>

          {(requestSent || responseReceived) && (
            <div className="mt-8 space-y-6 pt-6 border-t">
              {requestSent && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center"><FileJson className="mr-2 h-5 w-5 text-blue-500" />Request Body (Dikirim ke Backend /api/ipaymu-playground-transaction)</h3>
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
                    Response (Diterima dari iPaymu via Backend Anda)
                  </h3>
                  <ScrollArea className="h-60 w-full rounded-md border bg-muted p-3">
                    <pre className="text-xs whitespace-pre-wrap break-all">
                      {typeof responseReceived === 'string' ? responseReceived : JSON.stringify(responseReceived, null, 2)}
                    </pre>
                  </ScrollArea>
                  {responseStatus === 'success' && (responseReceived as any)?.Data?.Url && (
                    <div className="mt-3">
                        <Button variant="outline" asChild>
                            <a href={(responseReceived as any).Data.Url} target="_blank" rel="noopener noreferrer">
                                Buka URL Pembayaran iPaymu (Jika diarahkan)
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
            <p>1. Halaman ini adalah untuk <strong className="text-destructive">latihan dan debugging</strong> integrasi API iPaymu Sandbox.</p>
            <p>2. **API Key Sandbox** yang Anda masukkan di form ini akan dikirim ke backend API route (`/api/ipaymu-playground-transaction`) untuk membuat request ke iPaymu. **Ini tidak aman untuk produksi!** Di produksi, API Key rahasia harus disimpan aman di server.</p>
            <p>3. Pastikan URL API iPaymu Sandbox dan format `signature` di file `/app/api/ipaymu-playground-transaction/route.ts` sudah sesuai dengan dokumentasi terbaru iPaymu.</p>
            <p>4. Untuk transaksi berhasil dan redirect ke halaman pembayaran iPaymu, iPaymu Sandbox harus mengenali VA dan API Key Anda serta signature yang dikirim.</p>
            <p>5. Jika terjadi error "unauthorized signature", periksa `console.log` di terminal backend Anda (tempat `npm run dev` berjalan) untuk detail `StringToSign` dan bandingkan dengan format yang diminta iPaymu.</p>
            <p>6. Jika Anda mendapatkan error "Unexpected end of JSON input" atau response tidak valid di browser, cek **konsol browser** dan **terminal backend** Anda untuk melihat log `Raw response...`.</p>
        </CardContent>
      </Card>
    </div>
  );
}

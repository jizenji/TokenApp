
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, User, CreditCard, Loader2, AlertTriangle, ArrowLeft, TicketPercent, Info, Zap, Droplet, Flame, Sun, PackageIcon, Filter as FilterIcon, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { CustomerData, CustomerService, GeneratedToken } from '@/types';
import { UserRole } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { generateFullOrderId } from '@/lib/orderUtils';
import { cn } from '@/lib/utils';
import Script from 'next/script'; 
import { Dialog, DialogClose, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter} from '@/components/ui/dialog'; 

const tokenTypeDisplayMap: Record<string, {name: string, icon: React.ElementType}> = {
  ELECTRICITY: { name: 'Listrik', icon: Zap },
  WATER: { name: 'Air', icon: Droplet },
  GAS: { name: 'Gas', icon: Flame },
  SOLAR: { name: 'Solar', icon: Sun },
  DEFAULT: { name: 'Lainnya', icon: PackageIcon },
};

const getPredefinedAmountsForService = (tokenType: string | undefined): string[] => {
  if (!tokenType) return ['20.000', '50.000', '100.000'];
  switch (tokenType.toUpperCase()) {
    case 'ELECTRICITY':
      return ['20.000', '50.000', '100.000', '200.000', '500.000'];
    case 'WATER':
      return ['50.000', '100.000', '150.000', '200.000'];
    case 'GAS':
    case 'SOLAR':
      return ['100.000', '250.000', '500.000', '750.000'];
    default:
      return ['25.000', '50.000', '75.000', '100.000'];
  }
};

export default function PembelianPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(true);
  const [errorCustomer, setErrorCustomer] = useState<string | null>(null);

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedServiceInfo, setSelectedServiceInfo] = useState<CustomerService | null>(null);
  
  const [amountInput, setAmountInput] = useState<string>('');
  const [amountError, setAmountError] = useState<string>('');
  
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isVendingToken, setIsVendingToken] = useState(false); 
  const [lastVendedToken, setLastVendedToken] = useState<GeneratedToken | null>(null);
  const [isVendedTokenDialogOpenn, setIsVendedTokenDialogOpen] = useState(false);


  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucherAmount, setAppliedVoucherAmount] = useState(0);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState('');

  const fetchCustomerData = useCallback(async () => {
    if (!authUser || !authUser.email || authUser.role !== UserRole.CUSTOMER) {
      setErrorCustomer("Hanya pelanggan yang dapat mengakses halaman ini.");
      setIsLoadingCustomer(false);
      return;
    }
    setIsLoadingCustomer(true);
    setErrorCustomer(null);
    try {
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where("customerEmail", "==", authUser.email), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const customerDoc = querySnapshot.docs[0];
        setCustomerData({ ...customerDoc.data(), id: customerDoc.id } as CustomerData);
      } else {
        setErrorCustomer("Data pelanggan tidak ditemukan. Silakan hubungi administrator.");
      }
    } catch (err) {
      console.error("Error fetching customer data:", err);
      setErrorCustomer("Gagal memuat data pelanggan.");
    } finally {
      setIsLoadingCustomer(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authLoading && authUser) {
      fetchCustomerData();
    } else if (!authLoading && !authUser) {
      setErrorCustomer("Silakan login untuk melakukan pembelian.");
      setIsLoadingCustomer(false);
    }
  }, [authLoading, authUser, fetchCustomerData]);

  useEffect(() => {
    if (selectedServiceId && customerData?.services) {
      const service = customerData.services.find(s => s.serviceId === selectedServiceId);
      setSelectedServiceInfo(service || null);
      setAmountInput('');
      setAmountError('');
    } else {
      setSelectedServiceInfo(null);
    }
  }, [selectedServiceId, customerData]);

  const validateAmount = useCallback((rawValue: string, tokenType?: string): string => {
    if (!rawValue) return "Jumlah pembelian harus diisi.";
    const numValue = parseInt(rawValue, 10);
    if (isNaN(numValue)) return "Input harus berupa angka.";
    if (numValue < 10000) return "Jumlah minimal Rp 10.000";
    if (numValue > 5000000) return "Jumlah maksimal Rp 5.000.000";
    if (tokenType && tokenType.toUpperCase() === 'ELECTRICITY' && numValue % 5000 !== 0) {
      return "Nominal listrik harus kelipatan Rp 5.000.";
    }
    return '';
  }, []);

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setAmountInput('');
      setAmountError(validateAmount(rawValue, selectedServiceInfo?.tokenType));
      return;
    }
    const numValue = parseInt(rawValue, 10);
    if (!isNaN(numValue)) {
      const formatted = numValue.toLocaleString('id-ID');
      setAmountInput(formatted);
      setAmountError(validateAmount(rawValue, selectedServiceInfo?.tokenType));
    } else {
      setAmountInput(e.target.value); 
      setAmountError("Input harus berupa angka.");
    }
  };

  const handlePredefinedAmountClick = (predefinedValue: string) => {
    setAmountInput(predefinedValue);
    setAmountError(validateAmount(predefinedValue.replace(/\./g, ''), selectedServiceInfo?.tokenType));
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherMessage('Mohon masukkan kode voucher.');
      setAppliedVoucherAmount(0);
      return;
    }
    setIsApplyingVoucher(true);
    setVoucherMessage('');
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    let discount = 0;
    let message = 'Kode voucher tidak valid atau sudah tidak berlaku.';
    let toastType: 'default' | 'destructive' = 'destructive';

    if (voucherCode.toUpperCase() === 'DISKON10K') {
      discount = 10000;
      message = `Voucher DISKON10K berhasil diterapkan! Anda hemat Rp ${discount.toLocaleString('id-ID')}.`;
      toastType = 'default';
    } else if (voucherCode.toUpperCase() === 'HEMAT5K') {
      discount = 5000;
      message = `Voucher HEMAT5K berhasil diterapkan! Anda hemat Rp ${discount.toLocaleString('id-ID')}.`;
      toastType = 'default';
    }
    
    setAppliedVoucherAmount(discount);
    setVoucherMessage(message);
    toast({
      title: toastType === 'default' ? "Voucher Diterapkan" : "Voucher Gagal",
      description: message,
      variant: toastType,
    });
    setIsApplyingVoucher(false);
  };

  const adminFee = 2500; 
  const biayaLain = 0; 

  const nominalBeli = parseInt(amountInput.replace(/\./g, ''), 10) || 0;
  const totalSebelumDiskon = nominalBeli > 0 ? nominalBeli + adminFee + biayaLain : (amountInput ? adminFee + biayaLain : 0);
  const totalBayar = Math.max(0, totalSebelumDiskon - appliedVoucherAmount);
  
  const handleBeli = async () => {
    if (!authUser || !customerData) {
      toast({ title: "Autentikasi Gagal", description: "Sesi Anda tidak valid atau data pelanggan tidak termuat. Silakan login ulang.", variant: "destructive" });
      setIsProcessing(false);
      router.push(ROUTES.LOGIN);
      return;
    }
    if (!selectedServiceId || !selectedServiceInfo) {
      toast({ title: "Validasi Gagal", description: "Silakan pilih layanan/ID Meter terlebih dahulu.", variant: "destructive" });
      return;
    }
    if (!amountInput || amountError) {
      toast({ title: "Validasi Gagal", description: `Periksa jumlah pembelian: ${amountError || "Jumlah harus diisi."}`, variant: "destructive" });
      return;
    }
     if (totalBayar < 10000 && nominalBeli > 0) {
        toast({ title: "Kesalahan Pembayaran", description: "Total pembayaran minimal adalah Rp 10.000 setelah diskon.", variant: "destructive" });
        return;
    }

    setIsProcessing(true);
    
    const referenceId = await generateFullOrderId(selectedServiceInfo?.tokenType || 'UNKNOWN', 'U');
    const serviceConfigType = selectedServiceInfo?.tokenType ? selectedServiceInfo.tokenType.toUpperCase() : 'DEFAULT';
    const serviceDisplayName = tokenTypeDisplayMap[serviceConfigType]?.name || tokenTypeDisplayMap.DEFAULT.name;

    const orderDetailsForMidtrans = {
      referenceId: referenceId,
      customerId: customerData.customerId, 
      totalPayment: totalBayar,
      productName: `Token ${serviceDisplayName} Rp ${nominalBeli.toLocaleString('id-ID')}`,
      productAmount: nominalBeli,
      buyerName: customerData?.customerName || authUser.displayName || 'Pelanggan',
      buyerEmail: customerData?.customerEmail || authUser.email || 'email@example.com',
      buyerPhone: customerData?.customerPhone || '081234567890',
      serviceIdForVending: selectedServiceId,
      tokenTypeForVending: selectedServiceInfo?.tokenType || 'UNKNOWN',
      adminFee: adminFee,
      taxAmount: 0, 
      otherCosts: biayaLain,
      discountAmount: appliedVoucherAmount,
      voucherCodeUsed: appliedVoucherAmount > 0 ? voucherCode : null,
      finishRedirectUrl: `${window.location.origin}${ROUTES.MY_TOKENS}`, 
      unfinishRedirectUrl: `${window.location.origin}${ROUTES.MY_TOKENS}`,
      errorRedirectUrl: `${window.location.origin}${ROUTES.MY_TOKENS}`,
    };

    try {
      const response = await fetch('/api/create-midtrans-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDetailsForMidtrans),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Gagal memproses permintaan pembayaran Midtrans.' }));
        throw new Error(errorData.message || 'Gagal membuat permintaan pembayaran ke Midtrans.');
      }
      const paymentResponseData = await response.json();

      if (paymentResponseData.token) {
        if (typeof window !== "undefined" && (window as any).snap) {
          (window as any).snap.pay(paymentResponseData.token, {
            onSuccess: async function(result: any){
              setIsProcessing(false);
              setIsVendingToken(true);
              toast({ 
                title: (<div className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /><span>Pembayaran Berhasil!</span></div>),
                description: `Memproses token untuk Order ID: ${result.order_id}...` 
              });
              
              try {
                const vendResponse = await fetch('/api/process-successful-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: result.order_id }),
                });
                const vendData = await vendResponse.json();
                if (vendResponse.ok && vendData.success && vendData.token) {
                   const vendedTokenDetails: GeneratedToken = {
                    id: result.order_id, 
                    orderId: result.order_id,
                    customerId: customerData.customerId,
                    customerName: customerData.customerName,
                    serviceId: selectedServiceId,
                    type: selectedServiceInfo.tokenType,
                    amount: orderDetailsForMidtrans.productAmount,
                    generatedTokenCode: vendData.token,
                    createdAt: new Date(),
                    // basePrice and unitValue will be calculated server-side by process-successful-payment
                  };
                  setLastVendedToken(vendedTokenDetails);
                  setIsVendedTokenDialogOpen(true);
                  toast({ 
                    title: (<div className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /><span>Token Berhasil Digenerate!</span></div>), 
                    description: `Token: ${vendData.token}`, 
                    duration: 10000
                  });
                } else {
                  toast({ title: "Vending Token Gagal", description: vendData.message || "Gagal mendapatkan token setelah pembayaran.", variant: "destructive", duration: 10000 });
                }
              } catch (vendError: any) {
                toast({ title: "Error Vending Token", description: vendError.message || "Terjadi kesalahan saat memproses token.", variant: "destructive", duration: 10000 });
              } finally {
                setIsVendingToken(false);
              }
            },
            onPending: function(result: any){
              toast({ title: "Pembayaran Pending", description: `Order ID: ${result.order_id}, Status: ${result.transaction_status}`, variant: "default" });
              if (isProcessing) setIsProcessing(false);
              router.push(`${orderDetailsForMidtrans.unfinishRedirectUrl}?status=pending&ref=${result.order_id}&transaction_status=${result.transaction_status}&status_code=${result.status_code}`);
            },
            onError: function(result: any){
              toast({ title: "Pembayaran Gagal", description: result.status_message || `Order ID: ${result.order_id || 'N/A'}`, variant: "destructive" });
              if (isProcessing) setIsProcessing(false);
              router.push(`${orderDetailsForMidtrans.errorRedirectUrl}?status=error&ref=${result.order_id || orderDetailsForMidtrans.referenceId}&status_code=${result.status_code || 'N/A'}&message=${encodeURIComponent(result.status_message || 'Unknown error')}`);
            },
            onClose: function(){
               if (isProcessing) {
                toast({ title: "Pembayaran Dibatalkan", description: "Anda menutup jendela pembayaran.", variant: "default" });
                setIsProcessing(false);
              }
            }
          });
        } else {
          toast({ title: "Error Pembayaran", description: "Modul pembayaran Snap.js tidak termuat.", variant: "destructive"});
          setIsProcessing(false);
        }
      } else {
        toast({ title: "Gagal Memulai Pembayaran", description: paymentResponseData.message || "Tidak ada token Snap dari Midtrans.", variant: "destructive" });
        setIsProcessing(false);
      }
    } catch (e: any) {
      toast({ title: "Error Pembayaran", description: e.message || "Gagal memproses permintaan pembayaran.", variant: "destructive" });
      setIsProcessing(false);
    }
  };
  
  const isPurchaseButtonDisabled = 
    isProcessing || 
    isVendingToken ||
    !selectedServiceId || 
    !amountInput || 
    !!amountError || 
    isLoadingCustomer ||
    (totalBayar < 10000 && nominalBeli > 0);

  const predefinedAmountsForSelectedService = getPredefinedAmountsForService(selectedServiceInfo?.tokenType);

  useEffect(() => {
    // Redirect if Pembelian route is no longer valid
    if (!ROUTES.PEMBELIAN) {
        router.replace(ROUTES.DASHBOARD);
        toast({
            title: "Halaman Tidak Tersedia",
            description: "Halaman pembelian telah dinonaktifkan.",
            variant: "destructive"
        });
    }
  }, [router, toast]);

  if (!ROUTES.PEMBELIAN) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0 flex justify-center items-center h-screen">
        <div className="text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Mengalihkan...</p>
        </div>
      </div>
    );
  }


  if (authLoading || (isLoadingCustomer && !customerData && !errorCustomer)) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-lg mx-auto shadow-xl">
          <CardHeader>
            <Skeleton className="h-8 w-3/5 mb-2" />
            <Skeleton className="h-6 w-4/5" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-1/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorCustomer) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-lg mx-auto shadow-xl">
          <CardHeader className="text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-2xl text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">{errorCustomer}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!customerData) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-lg mx-auto shadow-xl">
          <CardHeader>
            <CardTitle>Data Tidak Tersedia</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground">Tidak dapat memuat informasi pelanggan saat ini.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Script
        id="midtrans-snap-js-pembelian" 
        src={process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"}
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX || "SB-Mid-client-YourClientKey"}
        strategy="afterInteractive"
        onError={(e) => {
            console.error('Midtrans Snap.js script failed to load on PembelianPage', e);
            toast({ title: 'Error Memuat Pembayaran', description: 'Gagal memuat modul pembayaran Midtrans. Coba muat ulang halaman.', variant: 'destructive', duration: 7000 });
        }}
      />
      <Card className="max-w-lg mx-auto shadow-xl border-primary/30">
        <CardHeader className="border-b pb-4">
          <div className="flex items-center space-x-3 mb-2">
            <ShoppingBag className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight text-primary">Pembelian Token</CardTitle>
          </div>
          <CardDescription className="text-md text-muted-foreground">
            Silakan pilih layanan dan masukkan jumlah pembelian Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="p-4 border rounded-lg bg-secondary/50">
            <div className="flex items-center space-x-2 mb-2">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-md font-semibold text-primary">Informasi Pelanggan</h3>
            </div>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium text-muted-foreground">Nama:</span> {customerData.customerName}</p>
              <p><span className="font-medium text-muted-foreground">ID Pelanggan:</span> {customerData.customerId}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="service-select" className="text-sm font-medium">Pilih Layanan / ID Meter</Label>
            <Select
              value={selectedServiceId}
              onValueChange={setSelectedServiceId}
              disabled={!customerData.services || customerData.services.length === 0}
            >
              <SelectTrigger id="service-select" className="mt-1 bg-background">
                <SelectValue placeholder={!customerData.services || customerData.services.length === 0 ? "Tidak ada layanan terdaftar" : "Pilih layanan..."} />
              </SelectTrigger>
              <SelectContent>
                {customerData.services && customerData.services.length > 0 ? (
                  customerData.services.map((service) => (
                    <SelectItem key={service.serviceId} value={service.serviceId}>
                      {service.serviceId} ({(tokenTypeDisplayMap[service.tokenType.toUpperCase()] || tokenTypeDisplayMap.DEFAULT).name})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-service" disabled>Tidak ada layanan tersedia</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedServiceInfo && (
            <div className="p-3 border rounded-md bg-muted/30 text-sm space-y-1">
              <p><span className="font-medium text-muted-foreground">Jenis:</span> {(tokenTypeDisplayMap[selectedServiceInfo.tokenType.toUpperCase()] || tokenTypeDisplayMap.DEFAULT).name}</p>
              <p><span className="font-medium text-muted-foreground">Area:</span> {selectedServiceInfo.areaProject}</p>
              <p><span className="font-medium text-muted-foreground">Project:</span> {selectedServiceInfo.project}</p>
              <p><span className="font-medium text-muted-foreground">Vendor:</span> {selectedServiceInfo.vendorName}</p>
              {selectedServiceInfo.powerOrVolume && <p><span className="font-medium text-muted-foreground">Daya/Volume:</span> {selectedServiceInfo.powerOrVolume}</p>}
            </div>
          )}
          
          <div>
            <Label htmlFor="purchase-amount" className="text-sm font-medium">Jumlah Pembelian (Rp)</Label>
            <div className="mt-1">
              <Input
                id="purchase-amount"
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 50000"
                className="bg-background"
                value={amountInput}
                onChange={handleAmountInputChange}
                disabled={!selectedServiceId || isProcessing || isVendingToken}
              />
            </div>
            {selectedServiceId && predefinedAmountsForSelectedService.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {predefinedAmountsForSelectedService.map(pa => (
                  <Button
                    key={pa}
                    type="button"
                    variant={amountInput === pa ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePredefinedAmountClick(pa)}
                    disabled={!selectedServiceId || isProcessing || isVendingToken}
                  >
                    Rp {pa}
                  </Button>
                ))}
              </div>
            )}
            {amountError && <p className="text-xs text-destructive mt-1">{amountError}</p>}
            {!amountError && amountInput && (
              <p className="text-xs text-muted-foreground mt-1">
                Nominal: Rp {parseInt(amountInput.replace(/\./g, ''), 10).toLocaleString('id-ID')}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="voucherCode" className="text-sm font-medium">Kode Voucher (Opsional)</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input 
                id="voucherCode" 
                placeholder="Masukkan kode voucher" 
                className="bg-background"
                value={voucherCode}
                onChange={(e) => {
                  setVoucherCode(e.target.value.toUpperCase());
                  if (appliedVoucherAmount > 0) { 
                    setAppliedVoucherAmount(0);
                    setVoucherMessage('Masukkan kode voucher baru dan terapkan.');
                  } else {
                    setVoucherMessage('');
                  }
                }}
                disabled={isProcessing || isVendingToken}
              />
              <Button type="button" onClick={handleApplyVoucher} disabled={isApplyingVoucher || !voucherCode.trim() || isProcessing || isVendingToken} variant="outline">
                {isApplyingVoucher ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TicketPercent className="h-4 w-4 mr-1 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Terapkan</span>
                <span className="sm:hidden">Ok</span>
              </Button>
            </div>
            {voucherMessage && (
              <p className={cn("text-xs mt-1", appliedVoucherAmount > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500')}>
                {voucherMessage}
              </p>
            )}
          </div>
          
          <div className="bg-secondary/70 p-4 rounded-lg text-sm space-y-1 border border-border">
            <p className="font-semibold text-primary">Ringkasan Pembelian:</p>
            <div className="flex justify-between">
                <span>Nominal Beli:</span> 
                <span className="font-medium">Rp {nominalBeli > 0 ? nominalBeli.toLocaleString('id-ID') : '0'}</span>
            </div>
            <div className="flex justify-between"><span>Biaya Admin:</span> <span className="font-medium">Rp {adminFee.toLocaleString('id-ID')}</span></div>
            {appliedVoucherAmount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-500">
                <span>Diskon Voucher ({voucherCode}):</span> 
                <span>- Rp {appliedVoucherAmount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <hr className="my-1 border-border" />
            <div className="flex justify-between font-bold text-base">
              <span className="text-primary">Total Bayar:</span> 
              <span>Rp {totalBayar > 0 ? totalBayar.toLocaleString('id-ID') : '0'}</span>
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button
            className="w-full text-lg py-3 h-auto bg-primary hover:bg-primary/90 rounded-lg"
            onClick={handleBeli}
            disabled={isPurchaseButtonDisabled}
          >
            {isProcessing || isVendingToken ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-foreground" />
            ) : (
              <CreditCard className="mr-2 h-5 w-5 text-primary-foreground" />
            )}
            <span className="text-primary-foreground">
              {isVendingToken ? 'Memproses Token...' : (isProcessing ? 'Ke Pembayaran...' : 'Lanjutkan Pembayaran')}
            </span>
          </Button>
          <Button variant="outline" onClick={() => router.back()} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Batal
          </Button>
        </CardFooter>
      </Card>

      {lastVendedToken && (
         <Dialog open={isVendedTokenDialogOpenn} onOpenChange={setIsVendedTokenDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center"><Zap className="mr-2 h-6 w-6 text-primary"/>Token Berhasil Digenerate!</DialogTitle>
                    <DialogDescription>Berikut adalah detail token untuk Order ID: {lastVendedToken.orderId}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-3 text-sm">
                    <p><strong>Nama Pelanggan:</strong> {lastVendedToken.customerName || '-'}</p>
                    <p><strong>ID Layanan:</strong> {lastVendedToken.serviceId}</p>
                    <p><strong>Jenis Token:</strong> {(tokenTypeDisplayMap[lastVendedToken.type.toUpperCase()] || tokenTypeDisplayMap.DEFAULT).name}</p>
                    <p><strong>Nominal (Rp):</strong> {lastVendedToken.amount.toLocaleString('id-ID')}</p>
                    <div className="pt-2">
                        <p className="font-semibold text-primary">Kode Token:</p>
                        <div className="flex items-center space-x-2 mt-1">
                            <code className="font-mono text-lg bg-muted px-3 py-2 rounded-md select-all">{lastVendedToken.generatedTokenCode}</code>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsVendedTokenDialogOpen(false)}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>
      )}
    </div>
  );
}


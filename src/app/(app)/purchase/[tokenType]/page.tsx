
'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Droplet, Flame, Sun, ArrowLeft, CreditCard, ShoppingCart, Loader2, TicketPercent, Info } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { CustomerData } from '@/types';
import { useAuth } from '@/hooks/use-auth'; // Import useAuth

// Mapping token types to display names and icons
const tokenInfoMap: { [key: string]: { name: string; Icon: React.ElementType } } = {
  listrik: { name: 'Listrik', Icon: Zap },
  air: { name: 'Air', Icon: Droplet },
  gas: { name: 'Gas', Icon: Flame },
  solar: { name: 'Solar', Icon: Sun },
  generic: { name: 'Layanan', Icon: ShoppingCart} // Fallback
};

export default function PurchaseTokenPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user: authUser } = useAuth(); // Get authenticated user
  
  const tokenType = typeof params.tokenType === 'string' ? params.tokenType : 'generic';
  const serviceIdFromQuery = searchParams.get('idPelanggan');
  
  const [customerId, setCustomerId] = useState(serviceIdFromQuery || '');
  const [isCustomerIdPrefilled, setIsCustomerIdPrefilled] = useState(!!serviceIdFromQuery);
  
  const [selectedAmount, setSelectedAmount] = useState('');
  const [customAmount, setCustomAmount] = useState(''); 
  const [customAmountError, setCustomAmountError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucherAmount, setAppliedVoucherAmount] = useState(0);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState('');

  const [customerNameDisplay, setCustomerNameDisplay] = useState('');
  const [customerDetails, setCustomerDetails] = useState<Partial<CustomerData> | null>(null);
  const [electricityPowerDisplay, setElectricityPowerDisplay] = useState('');
  const [isFetchingCustomerData, setIsFetchingCustomerData] = useState(false);

  const currentTokenInfo = tokenInfoMap[tokenType] || tokenInfoMap.generic;

  const fetchCustomerDetailsByServiceId = useCallback(async (serviceIdToFetch: string) => {
    if (!serviceIdToFetch) return;
    setIsFetchingCustomerData(true);
    setCustomerNameDisplay('');
    setElectricityPowerDisplay('');
    setCustomerDetails(null);

    try {
      const customersRef = collection(db, 'customers');
      let foundCustomer: CustomerData | null = null;
      const snapshot = await getDocs(customersRef);
      snapshot.forEach(doc => {
        const data = doc.data() as CustomerData;
        if (data.services && data.services.some(s => s.serviceId === serviceIdToFetch && s.tokenType === tokenType.toUpperCase())) {
          foundCustomer = { ...data, id: doc.id };
        }
      });

      if (foundCustomer) {
        setCustomerDetails(foundCustomer);
        setCustomerNameDisplay(foundCustomer.customerName);
        if (tokenType === 'listrik') {
          setElectricityPowerDisplay('1300 VA (Contoh)');
        }
      } else {
         if(!isCustomerIdPrefilled) {
            setCustomerNameDisplay('');
         }
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
    } finally {
      setIsFetchingCustomerData(false);
    }
  }, [tokenType, isCustomerIdPrefilled]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetailsByServiceId(customerId);
    } else {
      setCustomerNameDisplay('');
      setElectricityPowerDisplay('');
      setCustomerDetails(null);
      setIsFetchingCustomerData(false);
    }
  }, [customerId, fetchCustomerDetailsByServiceId]);
  
  const getPredefinedAmounts = (type: string) => {
    switch (type) {
      case 'listrik':
        return ['20.000', '50.000', '100.000', '200.000', '500.000'];
      case 'air':
        return ['50.000', '100.000', '150.000', '200.000'];
      case 'gas':
      case 'solar':
        return ['100.000', '250.000', '500.000', '750.000'];
      default:
        return ['25.000', '50.000', '75.000', '100.000'];
    }
  };

  const predefinedAmounts = getPredefinedAmounts(tokenType);

  const validateCustomAmount = (rawValue: string): string => { 
    if (rawValue.trim() === '') {
      return 'Nominal tidak boleh kosong.';
    }
    const numValue = parseInt(rawValue);
    if (isNaN(numValue)) {
      return 'Input harus berupa angka.';
    }
    if (numValue < 10000) { // Min iPaymu often 10k
      return 'Nominal minimal adalah Rp 10.000.';
    }
    if (numValue > 10000000) {
      return 'Nominal maksimal adalah Rp 10.000.000.';
    }
    // iPaymu might not have Rp 5.000 increment rule, adjust if necessary
    // if (numValue % 5000 !== 0) {
    //   return 'Nominal harus kelipatan Rp 5.000.';
    // }
    return ''; 
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/\D/g, ''); 
    
    if (rawValue.length > 8) { 
        rawValue = rawValue.substring(0, 8);
    }

    if (rawValue === '') {
      setCustomAmount('');
      setCustomAmountError(validateCustomAmount(rawValue)); 
      return;
    }

    const numValue = parseInt(rawValue);
    if (!isNaN(numValue)) {
      setCustomAmount(numValue.toLocaleString('id-ID')); 
      setCustomAmountError(validateCustomAmount(rawValue)); 
    } else {
      setCustomAmount(''); 
      setCustomAmountError('Input tidak valid.');
    }
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

  let amountToPayDisplay = '0';
  let amountToPayForCalculation = 0;

  if (selectedAmount === 'custom') {
    const customNum = parseInt(customAmount.replace(/\./g, '')) || 0;
    if (customAmount && !customAmountError) { 
      amountToPayDisplay = customAmount; 
      amountToPayForCalculation = customNum;
    } else { 
      amountToPayDisplay = '0'; 
      amountToPayForCalculation = 0; 
    }
  } else if (selectedAmount) { 
    amountToPayDisplay = selectedAmount; 
    amountToPayForCalculation = parseInt(selectedAmount.replace(/\./g, '')) || 0;
  }
  
  const grossTotalBeforeDiscount = amountToPayForCalculation > 0 
    ? amountToPayForCalculation + adminFee + biayaLain 
    : (selectedAmount ? adminFee + biayaLain : 0); 
  
  const totalPayment = Math.max(0, grossTotalBeforeDiscount - appliedVoucherAmount);
  
  const handlePurchase = async () => {
    if (!authUser) {
      toast({ title: "Autentikasi Gagal", description: "Sesi Anda tidak valid. Silakan login ulang.", variant: "destructive" });
      setIsLoading(false);
      router.push(ROUTES.LOGIN);
      return;
    }
    if (!customerId) {
      toast({ title: "Kesalahan Input", description: "Mohon masukkan ID Pelanggan/Meter Anda.", variant: "destructive" });
      return;
    }
    if (amountToPayForCalculation <= 0) {
        toast({ title: "Kesalahan Input", description: "Nominal pembelian belum dipilih atau tidak valid.", variant: "destructive" });
        return;
    }
    if (selectedAmount === 'custom' && customAmountError) {
      toast({ title: "Kesalahan Nominal Custom", description: customAmountError, variant: "destructive" });
      return;
    }
    if (totalPayment < 10000 && amountToPayForCalculation > 0) {
        toast({ title: "Kesalahan Pembayaran", description: "Total pembayaran minimal adalah Rp 10.000 setelah diskon.", variant: "destructive" });
        return;
    }

    setIsLoading(true);

    const orderDetails = {
      serviceId: customerId,
      tokenType: currentTokenInfo.name,
      productName: `Token ${currentTokenInfo.name} Rp ${amountToPayDisplay}`,
      productAmount: amountToPayForCalculation, // Nominal tokennya
      adminFee: adminFee,
      otherCosts: biayaLain,
      discount: appliedVoucherAmount,
      totalPayment: totalPayment, // Total yang harus dibayar
      buyerUid: authUser.uid, // UID Pengguna Firebase
      buyerName: customerNameDisplay || customerDetails?.customerName || authUser.displayName || 'Pelanggan',
      buyerEmail: customerDetails?.customerEmail || authUser.email || 'email@example.com',
      buyerPhone: customerDetails?.customerPhone || '081234567890', // Ambil dari profil pelanggan atau user auth
      referenceId: `TOK-${tokenType.toUpperCase()}-${Date.now()}`, // ID Order Unik
      voucherCode: voucherCode || null,
    };

    try {
      // Ganti '/api/create-ipaymu-payment' dengan URL Firebase Function Anda jika menggunakan Functions
      const response = await fetch('/api/create-ipaymu-payment', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Jika Anda menggunakan Firebase Auth token untuk melindungi API:
          // 'Authorization': `Bearer ${await authUser.getIdToken()}` 
        },
        body: JSON.stringify(orderDetails),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Gagal memproses permintaan pembayaran. Respons tidak valid.' }));
        throw new Error(errorData.message || 'Gagal membuat permintaan pembayaran.');
      }

      const paymentData = await response.json();

      if (paymentData.Data && paymentData.Data.Url) {
        // Arahkan pengguna ke halaman pembayaran iPaymu
        window.location.href = paymentData.Data.Url;
      } else {
        // Handle jika URL tidak ada, mungkin ada metode lain atau error dari iPaymu
        console.error("Respon iPaymu tidak mengandung URL pembayaran:", paymentData);
        toast({ title: "Gagal Memulai Pembayaran", description: paymentData.Message || "Tidak ada URL pembayaran dari iPaymu.", variant: "destructive" });
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error("Payment initiation error:", error);
      toast({ title: "Error Pembayaran", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  if (!tokenType || !tokenInfoMap[tokenType]) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0">
        <Card className="max-w-lg mx-auto shadow-xl bg-card">
          <CardHeader>
            <CardTitle className="text-destructive">Jenis Token Tidak Valid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-card-foreground">Jenis token yang diminta tidak valid atau tidak ditemukan.</p>
            <Button onClick={() => router.back()} className="mt-6" variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const noAmountChosen = !selectedAmount;
  const isNominalSelectedInvalid = selectedAmount !== 'custom' && (parseInt(selectedAmount.replace(/\./g, '')) || 0) <= 0;
  const isCustomNominalInvalid = selectedAmount === 'custom' && (
    !customAmount || 
    customAmountError !== '' || 
    (parseInt(customAmount.replace(/\./g, '')) || 0) <= 0 
  );

  const isPurchaseButtonDisabled = 
    isLoading ||
    !customerId ||
    noAmountChosen ||
    isNominalSelectedInvalid ||
    isCustomNominalInvalid ||
    (totalPayment < 10000 && amountToPayForCalculation > 0);


  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-lg mx-auto shadow-xl border-primary/30 bg-card">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-3">
            <currentTokenInfo.Icon className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-primary">
            Beli Token {currentTokenInfo.name}
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Selesaikan pembelian token Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-card-foreground">
          <div>
            <Label htmlFor="token-id-pelanggan" className="text-sm font-medium">Nomor ID Pelanggan/Layanan</Label>
            <Input 
              id="token-id-pelanggan" 
              placeholder={`Masukkan ID ${currentTokenInfo.name} Anda`} 
              className="mt-1 bg-input text-card-foreground placeholder:text-muted-foreground" 
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                if (isCustomerIdPrefilled && e.target.value !== serviceIdFromQuery) {
                  setIsCustomerIdPrefilled(false);
                }
              }}
              readOnly={isCustomerIdPrefilled}
            />
            <p className="text-xs text-muted-foreground mt-1">Pastikan ID yang Anda masukkan sudah benar.</p>
          </div>

          {isFetchingCustomerData && (
            <div className="space-y-2 mt-4 mb-2 p-3 bg-muted/30 rounded-md">
              <Skeleton className="h-4 w-3/4" />
              {tokenType === 'listrik' && <Skeleton className="h-4 w-1/2" />}
            </div>
          )}
          {!isFetchingCustomerData && (customerNameDisplay || (customerDetails && customerDetails.customerName)) && (
            <div className="space-y-1 mt-4 mb-3 p-3 bg-secondary/70 rounded-lg border border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nama Pelanggan:</span>
                <span className="font-medium text-orange-500 dark:text-orange-400">{customerNameDisplay || customerDetails?.customerName}</span>
              </div>
              {tokenType === 'listrik' && electricityPowerDisplay && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Daya Listrik:</span>
                  <span className="font-medium text-orange-500 dark:text-orange-400">{electricityPowerDisplay}</span>
                </div>
              )}
              {customerDetails?.customerAddress && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Alamat:</span>
                  <span className="font-medium text-right truncate max-w-[60%]">{customerDetails.customerAddress}</span>
                </div>
              )}
            </div>
          )}
          {!isFetchingCustomerData && customerId.length >= 5 && !(customerNameDisplay || (customerDetails && customerDetails.customerName)) && !isCustomerIdPrefilled && (
             <div className="mt-4 mb-3 p-3 bg-destructive/10 rounded-lg border border-destructive/30 text-sm text-destructive dark:text-red-400">
                Pelanggan dengan ID Layanan <span className="font-semibold">{customerId}</span> tidak ditemukan atau tidak terkait dengan akun Anda.
            </div>
          )}

          <div>
            <Label htmlFor="amount" className="text-sm font-medium">Pilih Nominal Pembelian (Rp)</Label>
            <Select 
              value={selectedAmount} 
              onValueChange={(value) => {
                setSelectedAmount(value); 
                if(value !== 'custom') {
                  setCustomAmount(''); 
                  setCustomAmountError(''); 
                } else {
                  setCustomAmountError(customAmount ? validateCustomAmount(customAmount.replace(/\D/g, '')) : validateCustomAmount(''));
                }
              }}
            >
              <SelectTrigger id="amount" className="mt-1 bg-input text-card-foreground placeholder:text-muted-foreground">
                <SelectValue placeholder="Pilih nominal" />
              </SelectTrigger>
              <SelectContent>
                {predefinedAmounts.map(amount => (
                  <SelectItem key={amount} value={amount}>
                    Rp {amount}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Nominal Lain...</SelectItem>
              </SelectContent>
            </Select>
          </div>
           {selectedAmount === 'custom' && (
             <div className="mt-3"> 
               <Label htmlFor="custom-amount" className="text-sm font-medium">Masukkan Nominal Lain (Rp)</Label>
               <Input 
                 id="custom-amount" 
                 type="text" 
                 placeholder="Contoh: 75000" 
                 className="mt-1 bg-input text-card-foreground placeholder:text-muted-foreground"
                 value={customAmount}
                 onChange={handleCustomAmountChange}
                />
                {customAmountError && (
                  <p className="text-xs text-destructive mt-1">{customAmountError}</p>
                )}
             </div>
           )}

          <div>
            <Label htmlFor="voucherCode" className="text-sm font-medium">Kode Voucher</Label>
            <div className="flex items-center space-x-2 mt-1">
              <Input 
                id="voucherCode" 
                placeholder="Masukkan kode voucher" 
                className="bg-input text-card-foreground placeholder:text-muted-foreground"
                value={voucherCode}
                onChange={(e) => {
                  setVoucherCode(e.target.value);
                  if (appliedVoucherAmount > 0) { 
                    setAppliedVoucherAmount(0);
                    setVoucherMessage('Masukkan kode voucher baru dan terapkan.');
                  } else {
                    setVoucherMessage('');
                  }
                }}
              />
              <Button type="button" onClick={handleApplyVoucher} disabled={isApplyingVoucher} variant="outline">
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
              <p className={`text-xs mt-1 ${appliedVoucherAmount > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                {voucherMessage}
              </p>
            )}
          </div>
          
          <div className="bg-secondary/70 p-4 rounded-lg text-sm space-y-1 border border-border">
            <p className="font-semibold text-primary">Ringkasan Pembelian:</p>
            <div className="flex justify-between">
                <span>Token:</span> 
                <span className="font-medium">{currentTokenInfo.name}</span>
            </div>
            <div className="flex justify-between">
                <span className={cn(selectedAmount === 'custom' && customAmountError && "text-destructive")}>Nominal:</span> 
                <span className={cn(
                    "font-medium",
                    selectedAmount === 'custom' && customAmountError && "text-destructive"
                )}>
                    Rp {amountToPayDisplay}
                </span>
            </div>
            <div className="flex justify-between"><span>Biaya Admin:</span> <span className="font-medium">Rp {adminFee.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Biaya Lain:</span> <span className="font-medium">Rp {biayaLain.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Voucher Disc:</span> <span className="font-medium text-green-600 dark:text-green-500">- Rp {appliedVoucherAmount.toLocaleString('id-ID')}</span></div>
            <hr className="my-1 border-border" />
            <div className="flex justify-between font-bold text-base">
              <span className="text-primary">Total Bayar:</span> 
              <span>Rp {totalPayment > 0 ? totalPayment.toLocaleString('id-ID') : '0'}</span>
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-6">
          <Button 
            onClick={handlePurchase} 
            className="w-full text-lg py-3 h-auto bg-primary hover:bg-primary/90 rounded-lg" 
            disabled={isPurchaseButtonDisabled}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-foreground" />
            ) : (
              <CreditCard className="mr-2 h-5 w-5 text-primary-foreground" />
            )}
            <span className="text-primary-foreground">
              {isLoading ? 'Memproses...' : 'Konfirmasi & Bayar'}
            </span>
          </Button>
          <Button variant="outline" onClick={() => router.back()} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" /> Batal
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    
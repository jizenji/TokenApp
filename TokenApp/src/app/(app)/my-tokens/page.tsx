
'use client';

import { useAuth } from '@/hooks/use-auth';
import { UserRole, type CustomerData, type CustomerService, type AllTokenSettings, type TokenSettingValues, type PurchaseFormState, type PromotionData, type GeneratedToken } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Zap, Droplet, Flame, Sun, Ticket, ShieldAlert, Loader2, Info, Building, Tag, Users, ShoppingCart, CreditCard, ArrowRight, TicketPercent, Gift, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, limit, doc, getDoc, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { PromotionCard } from '@/components/dashboard/promotion-card'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { generateFullOrderId } from '@/lib/orderUtils'; 
import Script from 'next/script';


const SERVICE_CONFIG_MAP: Record<string, { 
  label: string; 
  Icon: React.ElementType; 
  routeKey: string; 
  defaultNote?: string;
  predefinedAmounts: string[]; 
}> = {
  ELECTRICITY: { label: 'Listrik', Icon: Zap, routeKey: 'listrik', defaultNote: 'Token listrik prabayar.', predefinedAmounts: ['20.000', '50.000', '100.000', '200.000', '500.000'] },
  WATER: { label: 'Air', Icon: Droplet, routeKey: 'air', defaultNote: 'Layanan air PDAM.', predefinedAmounts: ['20.000', '50.000', '100.000', '200.000', '500.000'] },
  GAS: { label: 'Gas', Icon: Flame, routeKey: 'gas', defaultNote: 'Layanan gas PGN.', predefinedAmounts: ['20.000', '50.000', '100.000', '200.000', '500.000'] },
  SOLAR: { label: 'Solar', Icon: Sun, routeKey: 'solar', defaultNote: 'Layanan energi solar.', predefinedAmounts: ['20.000', '50.000', '100.000', '200.000', '500.000'] },
  DEFAULT: { label: 'Layanan', Icon: Ticket, routeKey: 'generic', defaultNote: 'Detail layanan.', predefinedAmounts: ['25.000', '50.000', '75.000', '100.000'] }
};

const TOKEN_TYPES_FOR_SETTINGS_FETCH = ['ELECTRICITY', 'WATER', 'GAS', 'SOLAR'];
const SIMULATED_CUSTOMER_POINTS = 500; 
const POINTS_TO_RP_CONVERSION_RATE = 1; 

const initialServicePurchaseFormState: Omit<PurchaseFormState, 'customerPoints'> = {
  selectedNominal: '',
  customNominalInput: '',
  customNominalError: '',
  calculatedPrice: null,
  voucherCode: '',
  voucherMessage: '',
  appliedVoucherAmount: 0,
  isApplyingVoucher: false,
  isRedeemingPoints: false,
  pointsDiscountAmount: 0,
  pointsMessage: '',
};

export default function MyTokensPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParamsHook = useSearchParams(); 
  const processedSearchParamsRef = useRef<string | null>(null);

  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [allTokenSettings, setAllTokenSettings] = useState<AllTokenSettings | null>(null);
  const [purchaseFormsState, setPurchaseFormsState] = useState<Record<string, PurchaseFormState>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null); 
  const [isVendingToken, setIsVendingToken] = useState<string | null>(null); 
  const [lastVendedToken, setLastVendedToken] = useState<GeneratedToken | null>(null);
  const [isVendedTokenDialogOpenn, setIsVendedTokenDialogOpen] = useState(false);


  const [promotions, setPromotions] = useState<PromotionData[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(false);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);

  const calculatePrice = useCallback((service: CustomerService, formState: PurchaseFormState): PurchaseFormState['calculatedPrice'] => {
    if (!allTokenSettings) {
      return null;
    }

    const nominalValueStr = formState.selectedNominal === 'custom'
      ? formState.customNominalInput.replace(/\./g, '')
      : formState.selectedNominal.replace(/\./g, '');

    const nominalValue = parseInt(nominalValueStr, 10) || 0;

    if (nominalValue <= 0) return null;
    if (formState.selectedNominal === 'custom' && formState.customNominalError) return null;
    
    const effectiveTokenType = service.tokenType.toUpperCase();
    const settingsForArea = allTokenSettings[effectiveTokenType]?.[service.areaProject];
    if (!settingsForArea) {
      return null;
    }

    const settingsForProject = settingsForArea[service.project];
    if (!settingsForProject) {
      return null;
    }
    
    const settings = settingsForProject[service.vendorName];
    if (!settings) {
       return { productAmount: nominalValue, adminFee: 0, taxAmount: 0, otherCosts: 0, totalPayment: nominalValue, originalTotalBeforeDiscount: nominalValue };
    }

    const productAmount = nominalValue;
    const adminFee = parseInt(String(settings.adminFee || '0').replace(/\D/g, ''), 10) || 0;
    const taxPercentage = parseFloat(String(settings.pajak || '0').replace(/[^0-9.]/g, '')) || 0;
    const otherCosts = parseInt(String(settings.otherCosts || '0').replace(/\D/g, ''), 10) || 0;

    const taxAmount = Math.round(productAmount * (taxPercentage / 100));
    const originalTotalBeforeDiscount = productAmount + adminFee + taxAmount + otherCosts;
    
    const activeDiscount = formState.isRedeemingPoints && (formState.pointsDiscountAmount || 0) > 0 
      ? (formState.pointsDiscountAmount || 0)
      : (formState.appliedVoucherAmount || 0);

    const totalPaymentAfterDiscount = Math.max(0, originalTotalBeforeDiscount - activeDiscount);

    return { productAmount, adminFee, taxAmount, otherCosts, totalPayment: totalPaymentAfterDiscount, originalTotalBeforeDiscount };
  }, [allTokenSettings]);

  const fetchAllTokenSettings = useCallback(async () => {
    const loadedSettings: AllTokenSettings = {};
    try {
      for (const tokenName of TOKEN_TYPES_FOR_SETTINGS_FETCH) {
        const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);
        const settingsDocSnap = await getDoc(settingsDocRef);
        if (settingsDocSnap.exists()) {
          const data = settingsDocSnap.data();
          loadedSettings[tokenName] = (data?.settings?.[tokenName]) || {};
        } else {
            loadedSettings[tokenName] = {}; 
        }
      }
      setAllTokenSettings(loadedSettings);
    } catch (err) {
      console.error("[MyTokensPage] Error fetching all token settings:", err);
      setAllTokenSettings({}); 
      throw err; 
    }
  }, []);

  const fetchCustomerData = useCallback(async () => {
    if (!authUser || !authUser.email) { 
      setError(authUser && authUser.role !== UserRole.CUSTOMER ? "Halaman ini khusus untuk pelanggan." : "Silakan login untuk melihat layanan Anda.");
      return;
    }
    if (authUser.role !== UserRole.CUSTOMER) {
        setError("Halaman ini khusus untuk pelanggan.");
        return; 
    }

    try {
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where("customerEmail", "==", authUser.email), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const customerDoc = querySnapshot.docs[0];
        const data = customerDoc.data() as CustomerData;
        setCustomerData({ ...data, id: customerDoc.id });

        const initialFormsState: Record<string, PurchaseFormState> = {};
        (data.services || []).forEach(service => {
          initialFormsState[service.serviceId] = {
            ...initialServicePurchaseFormState,
            customerPoints: SIMULATED_CUSTOMER_POINTS,
          };
        });
        setPurchaseFormsState(initialFormsState);
      } else {
        setError("Data pelanggan tidak ditemukan. Hubungi administrator jika ini adalah kesalahan.");
      }
    } catch (err) {
      console.error("[MyTokensPage] Error fetching customer data:", err);
      throw err; 
    }
  }, [authUser]); 

  const fetchPromotions = useCallback(async () => {
    if (promotions.length > 0 && !isLoadingPromotions) return;
    if (isLoadingPromotions) return;
    setIsLoadingPromotions(true);
    try {
      const promotionsCol = collection(db, 'promotions');
      const q = query(promotionsCol, where('isActive', '==', true), orderBy('displayOrder', 'asc'), orderBy('createdAt', 'desc'), limit(10)); 
      const querySnapshot = await getDocs(q);
      const fetchedPromotions = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id, ...docSnap.data(), createdAt: (docSnap.data().createdAt as Timestamp).toDate()
        }) as PromotionData);
      setPromotions(fetchedPromotions);
    } catch (fetchPromotionsError) {
      console.error("Error fetching promotions for dialog:", fetchPromotionsError);
      toast({ title: "Gagal Memuat Promosi", description: "Tidak dapat memuat daftar promosi saat ini.", variant: "destructive" });
    } finally {
      setIsLoadingPromotions(false);
    }
  }, [promotions.length, isLoadingPromotions, toast]); 


  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null); 
      if (!authLoading && authUser) {
        try {
          await Promise.all([ fetchCustomerData(), fetchAllTokenSettings() ]);
        } catch (e: any) {
            setError(e.message || "Gagal memuat semua data yang dibutuhkan.");
            if (!customerData) setCustomerData(null); 
            if (!allTokenSettings) setAllTokenSettings({});
        }
      } else if (!authLoading && !authUser) {
         setError("Silakan login untuk melihat layanan Anda.");
      }
      setIsLoading(false);
    };
    loadInitialData();
  }, [authLoading, authUser, fetchCustomerData, fetchAllTokenSettings]);

  useEffect(() => {
    if (!customerData?.services || !allTokenSettings || Object.keys(allTokenSettings).length === 0) {
      return;
    }
    setPurchaseFormsState(prevFormsState => {
      let hasChanges = false;
      const newFormsState = { ...prevFormsState };
      customerData.services.forEach(service => {
        const currentFormState = prevFormsState[service.serviceId];
        if (currentFormState && currentFormState.selectedNominal) {
          const newPrice = calculatePrice(service, currentFormState);
          if (JSON.stringify(newPrice) !== JSON.stringify(currentFormState.calculatedPrice)) {
            newFormsState[service.serviceId] = { ...currentFormState, calculatedPrice: newPrice };
            hasChanges = true;
          }
        } else if (currentFormState && !currentFormState.selectedNominal && currentFormState.calculatedPrice !== null) {
          newFormsState[service.serviceId] = { ...currentFormState, calculatedPrice: null };
          hasChanges = true;
        }
      });
      return hasChanges ? newFormsState : prevFormsState;
    });
  }, [allTokenSettings, customerData, calculatePrice]);


  const validateCustomNominal = useCallback((rawValue: string): string => {
    const numValue = parseInt(rawValue.replace(/\D/g, ''), 10);
    if (isNaN(numValue) || numValue <= 0) return 'Nominal harus diisi dan lebih dari 0.';
    if (numValue < 10000) return 'Nominal minimal adalah Rp 10.000.';
    if (numValue > 1000000) return 'Nominal maksimal adalah Rp 1.000.000.';
    if (numValue % 5000 !== 0) return 'Nominal harus kelipatan Rp 5.000.';
    return '';
  }, []);

  const handleNominalSelect = useCallback((serviceId: string, nominal: string) => {
    const service = customerData?.services.find(s => s.serviceId === serviceId);
    if (!service) return;

    setPurchaseFormsState(prev => {
      const currentFormState = prev[serviceId] || { ...initialServicePurchaseFormState, customerPoints: SIMULATED_CUSTOMER_POINTS };
      let newCustomNominalError = '';
      if (nominal === 'custom' && currentFormState.customNominalInput) {
        newCustomNominalError = validateCustomNominal(currentFormState.customNominalInput.replace(/\./g, ''));
      } else if (nominal === 'custom' && !currentFormState.customNominalInput) {
        newCustomNominalError = 'Nominal harus diisi.'; 
      }

      const updatedFields = {
        ...currentFormState,
        selectedNominal: nominal,
        customNominalInput: nominal === 'custom' ? currentFormState.customNominalInput : '',
        customNominalError: newCustomNominalError,
      };
      const newPrice = calculatePrice(service, updatedFields);

      return { ...prev, [serviceId]: { ...updatedFields, calculatedPrice: newPrice }};
    });
  }, [customerData, calculatePrice, validateCustomNominal]);

  const handleCustomNominalChange = useCallback((serviceId: string, value: string) => {
    const service = customerData?.services.find(s => s.serviceId === serviceId);
    if (!service) return;

    let rawValue = value.replace(/\D/g, '');
    if (rawValue.length > 7) rawValue = rawValue.substring(0, 7); 

    const formattedValue = rawValue === '' ? '' : parseInt(rawValue, 10).toLocaleString('id-ID');
    const error = validateCustomNominal(rawValue);

    setPurchaseFormsState(prev => {
      const currentFormState = prev[serviceId] || { ...initialServicePurchaseFormState, customerPoints: SIMULATED_CUSTOMER_POINTS };
      const updatedFields = { ...currentFormState, customNominalInput: formattedValue, customNominalError: error };
      const newPrice = error ? null : calculatePrice(service, updatedFields);
      return { ...prev, [serviceId]: { ...updatedFields, calculatedPrice: newPrice }};
    });
  }, [customerData, calculatePrice, validateCustomNominal]);

  const handleVoucherCodeChange = useCallback((serviceId: string, code: string) => {
    setPurchaseFormsState(prev => ({
      ...prev,
      [serviceId]: {
        ...(prev[serviceId] || { ...initialServicePurchaseFormState, customerPoints: SIMULATED_CUSTOMER_POINTS }),
        voucherCode: code.toUpperCase(),
        voucherMessage: '', 
        isRedeemingPoints: false, 
        pointsDiscountAmount: 0,
        pointsMessage: code.trim() !== '' ? 'Penggunaan poin dinonaktifkan karena voucher sedang diisi.' : (prev[serviceId] || initialServicePurchaseFormState).pointsMessage,
      }
    }));
  }, []);

  const handleApplyVoucher = useCallback(async (serviceId: string) => {
    const service = customerData?.services.find(s => s.serviceId === serviceId);
    if (!service) return;
    
    const formState = purchaseFormsState[serviceId];
    if (!formState || !formState.voucherCode.trim()) {
      setPurchaseFormsState(prev => ({ ...prev, [serviceId]: { ...formState, voucherMessage: 'Masukkan kode voucher.', appliedVoucherAmount: 0 } }));
      return;
    }

    setPurchaseFormsState(prev => ({ ...prev, [serviceId]: { ...formState, isApplyingVoucher: true, voucherMessage: '', isRedeemingPoints: false, pointsDiscountAmount: 0, pointsMessage: 'Poin dinonaktifkan karena voucher diterapkan.' } }));
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    let discount = 0;
    let message = 'Kode voucher tidak valid atau sudah tidak berlaku.';
    let toastType: 'default' | 'destructive' = 'destructive';

    if (formState.voucherCode === 'DISKON10K') { discount = 10000; message = `Voucher DISKON10K diterapkan! Hemat Rp ${discount.toLocaleString('id-ID')}.`; toastType = 'default'; }
    else if (formState.voucherCode === 'HEMAT5K') { discount = 5000; message = `Voucher HEMAT5K diterapkan! Hemat Rp ${discount.toLocaleString('id-ID')}.`; toastType = 'default'; }
    
    setPurchaseFormsState(prev => {
      const stateWithDiscount = { ...formState, appliedVoucherAmount: discount, voucherMessage: message, isApplyingVoucher: false };
      const newPrice = calculatePrice(service, stateWithDiscount);
      return { ...prev, [serviceId]: { ...stateWithDiscount, calculatedPrice: newPrice }};
    });
    toast({ title: toastType === 'default' ? "Voucher Diterapkan" : "Voucher Gagal", description: message, variant: toastType });
  }, [purchaseFormsState, calculatePrice, toast, customerData]);

  const handleRedeemPointsToggle = useCallback((serviceId: string, checked: boolean) => {
    const service = customerData?.services.find(s => s.serviceId === serviceId);
    if (!service) return;

    setPurchaseFormsState(prev => {
      const currentForm = prev[serviceId];
      let pointsDiscount = 0;
      let message = '';
      let newAppliedVoucherAmount = currentForm.appliedVoucherAmount;
      let newVoucherMessage = currentForm.voucherMessage;
      let newVoucherCode = currentForm.voucherCode;

      if (checked) {
        const customerPoints = currentForm.customerPoints || 0;
        const redeemablePoints = Math.min(customerPoints, 500); 
        pointsDiscount = redeemablePoints * POINTS_TO_RP_CONVERSION_RATE; 
        message = `Anda menukarkan ${redeemablePoints} poin untuk diskon Rp ${pointsDiscount.toLocaleString('id-ID')}.`;
        newAppliedVoucherAmount = 0; newVoucherMessage = 'Voucher dinonaktifkan karena poin digunakan.'; newVoucherCode = ''; 
        toast({ title: "Poin Diterapkan", description: message });
      } else {
        message = 'Penukaran poin dibatalkan.';
        toast({ title: "Poin Dibatalkan", description: message, variant: "default" });
      }

      const stateWithPoints = { ...currentForm, isRedeemingPoints: checked, pointsDiscountAmount: pointsDiscount, pointsMessage: message, appliedVoucherAmount: newAppliedVoucherAmount, voucherMessage: newVoucherMessage, voucherCode: newVoucherCode };
      const newPrice = calculatePrice(service, stateWithPoints);
      return { ...prev, [serviceId]: { ...stateWithPoints, calculatedPrice: newPrice }};
    });
  }, [calculatePrice, toast, customerData]);

  const handlePurchase = useCallback(async (service: CustomerService) => {
    if (!authUser || !customerData || !allTokenSettings) return;
    const formState = purchaseFormsState[service.serviceId];

    if (!formState || !formState.selectedNominal) { toast({ title: "Pembelian Gagal", description: "Pilih nominal pembelian terlebih dahulu.", variant: "destructive" }); return; }
    if (formState.selectedNominal === 'custom' && formState.customNominalError) { toast({ title: "Pembelian Gagal", description: `Nominal kustom tidak valid: ${formState.customNominalError}`, variant: "destructive" }); return; }
    if (!formState.calculatedPrice || (formState.calculatedPrice.totalPayment <= 0 && formState.calculatedPrice.productAmount > 0)) { toast({ title: "Pembelian Gagal", description: "Total pembayaran tidak valid.", variant: "destructive" }); return; }
    if (formState.calculatedPrice && formState.calculatedPrice.totalPayment < 10000 && formState.calculatedPrice.productAmount > 0) { toast({ title: "Pembelian Gagal", description: "Total pembayaran minimal Rp 10.000 (Midtrans).", variant: "destructive" }); return; }

    setIsProcessingPayment(service.serviceId);
    
    const serviceConfig = SERVICE_CONFIG_MAP[service.tokenType.toUpperCase()] || SERVICE_CONFIG_MAP.DEFAULT;
    const uniqueReferenceId = await generateFullOrderId(service.tokenType, 'U');
    
    const activeDiscount = formState.isRedeemingPoints ? (formState.pointsDiscountAmount || 0) : (formState.appliedVoucherAmount || 0);
    const discountType = formState.isRedeemingPoints && activeDiscount > 0 ? "POINTS" : (activeDiscount > 0 ? "VOUCHER" : null);

    const orderDetailsForMidtrans = {
      referenceId: uniqueReferenceId,
      customerId: customerData.customerId, 
      totalPayment: formState.calculatedPrice.totalPayment,
      productName: `Token ${serviceConfig.label} Rp ${formState.calculatedPrice.productAmount.toLocaleString('id-ID')}`,
      productAmount: formState.calculatedPrice.productAmount,
      buyerName: customerData.customerName,
      buyerEmail: customerData.customerEmail,
      buyerPhone: customerData.customerPhone || 'N/A',
      serviceIdForVending: service.serviceId,
      tokenTypeForVending: service.tokenType,
      adminFee: formState.calculatedPrice.adminFee,
      taxAmount: formState.calculatedPrice.taxAmount,
      otherCosts: formState.calculatedPrice.otherCosts,
      discountAmount: activeDiscount,
      voucherCodeUsed: discountType === 'VOUCHER' ? formState.voucherCode : null,
      pointsRedeemed: discountType === 'POINTS' ? Math.min(formState.customerPoints || 0, 500) : 0,
      originalTotalBeforeDiscount: formState.calculatedPrice.originalTotalBeforeDiscount,
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
              setIsProcessingPayment(null); 
              setIsVendingToken(service.serviceId); 
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
                    serviceId: service.serviceId,
                    type: service.tokenType,
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
                setIsVendingToken(null);
              }
            },
            onPending: function(result: any){
              toast({ title: "Pembayaran Pending", description: `Order ID: ${result.order_id}, Status: ${result.transaction_status}`, variant: "default" });
              if (isProcessingPayment === service.serviceId) setIsProcessingPayment(null);
              router.push(`${orderDetailsForMidtrans.unfinishRedirectUrl || orderDetailsForMidtrans.finishRedirectUrl}?status=pending&ref=${result.order_id}&transaction_status=${result.transaction_status}&status_code=${result.status_code}`);
            },
            onError: function(result: any){
              toast({ title: "Pembayaran Gagal", description: result.status_message || `Order ID: ${result.order_id || 'N/A'}`, variant: "destructive" });
              if (isProcessingPayment === service.serviceId) setIsProcessingPayment(null);
              router.push(`${orderDetailsForMidtrans.errorRedirectUrl || orderDetailsForMidtrans.finishRedirectUrl}?status=error&ref=${result.order_id || orderDetailsForMidtrans.referenceId}&status_code=${result.status_code || 'N/A'}&message=${encodeURIComponent(result.status_message || 'Unknown error')}`);
            },
            onClose: function(){
              if (isProcessingPayment === service.serviceId) { 
                toast({ title: "Pembayaran Dibatalkan", description: "Anda menutup jendela pembayaran.", variant: "default" });
                setIsProcessingPayment(null); 
              }
            }
          });
        } else {
          toast({ title: "Error Pembayaran", description: "Modul pembayaran Snap.js tidak termuat dengan benar.", variant: "destructive"});
          setIsProcessingPayment(null);
        }
      } else {
        toast({ title: "Gagal Memulai Pembayaran", description: paymentResponseData.message || "Tidak ada token Snap dari Midtrans.", variant: "destructive" });
        setIsProcessingPayment(null);
      }
    } catch (e: any) {
      toast({ title: "Error Pembayaran", description: e.message || "Gagal memproses permintaan pembayaran.", variant: "destructive" });
      setIsProcessingPayment(null);
    }
  }, [authUser, customerData, allTokenSettings, purchaseFormsState, toast, router, isProcessingPayment]);
  
 useEffect(() => {
    if (typeof window !== 'undefined') {
        const currentParamsString = searchParamsHook.toString();
        if (processedSearchParamsRef.current === currentParamsString && currentParamsString !== '') {
             return; 
        }
        processedSearchParamsRef.current = currentParamsString;

        const status = searchParamsHook.get('status');
        const ref = searchParamsHook.get('ref');
        const midtransStatusCode = searchParamsHook.get('status_code');
        const midtransTxStatus = searchParamsHook.get('transaction_status');
        const message = searchParamsHook.get('message');

        if (status && ref) {
            if (status === 'success' && !isVendedTokenDialogOpenn && !isVendingToken) { 
                toast({ 
                  title: (<div className="flex items-center"><CheckCircle2 className="mr-2 h-5 w-5 text-green-500" /><span>Pembayaran Diproses (Midtrans)</span></div>),
                  description: `Status Transaksi ${ref}: ${midtransTxStatus || 'Berhasil'} (Kode: ${midtransStatusCode || 'N/A'})` });
            } else if (status === 'cancel' || status === 'unfinish' || status === 'pending') {
                 toast({ title: "Pembayaran Dibatalkan/Belum Selesai", description: `Transaksi ${ref} belum selesai. Status: ${midtransTxStatus || 'Pending'} (Kode: ${midtransStatusCode || 'N/A'})`, variant: "default" });
            } else if (status === 'error') {
                toast({ title: "Pembayaran Gagal (Midtrans)", description: `Masalah dengan transaksi ${ref}. Pesan: ${message || 'Error tidak diketahui'} (Kode: ${midtransStatusCode || 'N/A'})`, variant: "destructive" });
            }
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('status');
            currentUrl.searchParams.delete('ref');
            currentUrl.searchParams.delete('status_code');
            currentUrl.searchParams.delete('transaction_status');
            currentUrl.searchParams.delete('message');
            router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
            if (currentParamsString === '') { // Reset if params become empty
                processedSearchParamsRef.current = null;
            }
        } else if (currentParamsString === '') { // If initially no params, ensure ref is null
             processedSearchParamsRef.current = null;
        }
    }
  }, [searchParamsHook, router, toast, isVendedTokenDialogOpenn, isVendingToken]);


  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-10"><Skeleton className="h-10 w-1/3 mb-2" /><Skeleton className="h-6 w-1/2" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
          {[1, 2].map(i => (<Card key={i} className="shadow-lg rounded-xl border"><CardHeader><Skeleton className="h-6 w-24 mb-1" /><Skeleton className="h-4 w-32" /></CardHeader><CardContent className="p-5 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent><CardFooter><Skeleton className="h-10 w-full rounded-md" /></CardFooter></Card>))}
        </div>
      </div>
    );
  }

  if (error) {
     return (
      <div className="container mx-auto py-12 px-4 md:px-0">
        <Alert variant="destructive" className="max-w-lg mx-auto shadow-md">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="font-semibold">Error</AlertTitle>
          <AlertDescription>{error} {(error.includes("login") || error.includes("tidak ditemukan") || error.includes("pelanggan")) && <Button asChild className="mt-3"><Link href={ROUTES.LOGIN}>Login</Link></Button>}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!customerData || !customerData.services || customerData.services.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:text-left"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Layanan Saya</h1><p className="mt-2 text-lg text-muted-foreground">Belum ada layanan yang terdaftar untuk akun Anda.</p></div>
        <Card className="shadow-lg border-dashed border-muted-foreground/30"><CardContent className="p-10 text-center flex flex-col items-center justify-center min-h-[200px]"><Ticket className="h-16 w-16 text-muted-foreground mb-4" /><p className="text-xl font-semibold text-muted-foreground">Belum ada layanan terdaftar.</p><p className="text-sm text-muted-foreground mt-1">Hubungi layanan pelanggan untuk mendaftarkan layanan Anda.</p><Button variant="outline" className="mt-6" asChild><Link href={ROUTES.CONTACT}>Hubungi Kami</Link></Button></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Script
        id="midtrans-snap-js"
        src={process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL || "https://app.sandbox.midtrans.com/snap/snap.js"}
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY_SANDBOX || "SB-Mid-client-YourClientKey"}
        strategy="afterInteractive"
        onError={(e) => {
            console.error('Midtrans Snap.js script failed to load', e);
            toast({ title: 'Error Memuat Pembayaran', description: 'Gagal memuat modul pembayaran Midtrans. Coba muat ulang halaman.', variant: 'destructive', duration: 7000 });
        }}
      />
      <div className="mb-10 text-center sm:text-left"><h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Layanan Saya</h1><p className="mt-2 text-lg text-[hsl(var(--darker-muted-foreground))]">Pilih layanan di bawah untuk melakukan pembelian token atau pembayaran.</p></div>
      <Accordion type="single" collapsible className="w-full space-y-6">
        {customerData.services.map((service) => {
          const serviceConfig = SERVICE_CONFIG_MAP[service.tokenType.toUpperCase()] || SERVICE_CONFIG_MAP.DEFAULT;
          const ServiceIcon = serviceConfig.Icon;
          const formState = purchaseFormsState[service.serviceId] || { ...initialServicePurchaseFormState, customerPoints: SIMULATED_CUSTOMER_POINTS };
          const isGloballyActive = customerData.isTransactionActive !== false; 
          const isServiceIndividuallyActive = service.isServiceTransactionActive !== false; 
          const canTransact = isGloballyActive && isServiceIndividuallyActive;
          const isCurrentServiceProcessing = isProcessingPayment === service.serviceId || isVendingToken === service.serviceId;
          const isPurchaseButtonDisabled = !canTransact || isCurrentServiceProcessing || !formState.selectedNominal || (formState.selectedNominal === 'custom' && (!!formState.customNominalError || !formState.customNominalInput)) || !formState.calculatedPrice || (formState.calculatedPrice.totalPayment < 10000 && formState.calculatedPrice.productAmount > 0);

          return (
            <AccordionItem value={service.serviceId} key={service.serviceId} className="border-none">
              <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out overflow-hidden rounded-xl border">
                <AccordionTrigger className="p-0 hover:no-underline focus:no-underline focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-primary/5 dark:data-[state=open]:bg-primary/10">
                  <CardHeader className="flex flex-row items-start justify-between w-full p-5 cursor-pointer"><div className="flex items-center space-x-3"><ServiceIcon className="h-8 w-8 text-primary" /><div><CardTitle className="text-xl font-semibold text-primary">{serviceConfig.label}</CardTitle><p className="text-sm text-muted-foreground">ID Meter: {service.serviceId}</p></div></div><div className="flex flex-col items-end text-right"><p className="text-xl font-semibold text-primary">{customerData.customerName}</p>{customerData.customerId && (<p className="text-sm text-muted-foreground">ID Pelanggan: {customerData.customerId}</p>)}</div></CardHeader>
                </AccordionTrigger>
                <AccordionContent><CardContent className="p-5 space-y-6">{!canTransact ? (<Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertTitle>Transaksi Dinonaktifkan</AlertTitle><AlertDescription>{!isGloballyActive ? "Transaksi global untuk akun Anda dinonaktifkan. " : "Transaksi untuk layanan spesifik ini dinonaktifkan. "}Pembelian tidak dapat dilakukan.</AlertDescription></Alert>) : (<><div><Label className="text-sm font-medium mb-2 block">Pilih Nominal Pembelian (Rp)</Label><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">{serviceConfig.predefinedAmounts.map(amount => (<Button key={amount} variant={formState.selectedNominal === amount ? "default" : "outline"} onClick={() => handleNominalSelect(service.serviceId, amount)} className="w-full text-center">Rp {amount}</Button>))}<Button variant={formState.selectedNominal === 'custom' ? "default" : "outline"} onClick={() => handleNominalSelect(service.serviceId, 'custom')} className="w-full text-center">Nominal Lain</Button></div>{formState.selectedNominal === 'custom' && (<div className="mt-3"><Label htmlFor={`custom-amount-${service.serviceId}`} className="text-sm font-medium">Masukkan Nominal Lain (Rp)</Label><Input id={`custom-amount-${service.serviceId}`} type="text" placeholder="Contoh: 75.000 (Kelipatan 5.000, Min 10.000, Max 1.000.000)" className="mt-1 bg-input placeholder:text-muted-foreground" value={formState.customNominalInput} onChange={(e) => handleCustomNominalChange(service.serviceId, e.target.value)} />{formState.customNominalError && (<p className="text-xs text-destructive mt-1">{formState.customNominalError}</p>)}</div>)}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-3 border-t border-border/50">
                      <div className="space-y-2">
                          <Label htmlFor={`voucher-${service.serviceId}`} className="text-sm font-medium">Kode Voucher</Label>
                          <div className="flex items-center space-x-2">
                              <Input id={`voucher-${service.serviceId}`} placeholder="Masukkan kode voucher" className="flex-grow bg-input placeholder:text-muted-foreground" value={formState.voucherCode} onChange={(e) => handleVoucherCodeChange(service.serviceId, e.target.value)} disabled={formState.isRedeemingPoints} />
                              <Button type="button" variant="outline" onClick={() => handleApplyVoucher(service.serviceId)} disabled={formState.isApplyingVoucher || !formState.voucherCode || formState.isRedeemingPoints} size="sm">{formState.isApplyingVoucher ? <Loader2 className="h-4 w-4 animate-spin" /> : "Terapkan"}</Button>
                              <Dialog open={isPromoDialogOpen} onOpenChange={setIsPromoDialogOpen}><DialogTrigger asChild><Button type="button" variant="ghost" size="icon" onClick={fetchPromotions} title="Lihat Promo"><Info className="h-5 w-5 text-primary" /></Button></DialogTrigger><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Promosi Saat Ini</DialogTitle></DialogHeader><ScrollArea className="max-h-[60vh] p-1">{isLoadingPromotions ? (<div className="flex justify-center items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Memuat promosi...</p></div>) : promotions.length > 0 ? (<div className="grid grid-cols-1 gap-4 p-2">{promotions.map(promo => (<PromotionCard key={promo.id} promotion={promo} />))}</div>) : (<p className="text-muted-foreground text-center py-8">Tidak ada promosi aktif.</p>)}</ScrollArea></DialogContent></Dialog>
                          </div>
                          {formState.voucherMessage && (<p className={cn("text-xs mt-1", formState.appliedVoucherAmount > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>{formState.voucherMessage}</p>)}
                      </div>
                      <div className="space-y-2">
                          <Label className="text-sm font-medium">Tukarkan Poin</Label>
                          <div className="flex items-center space-x-3 bg-muted/30 p-3 rounded-md border"><Checkbox id={`redeem-points-${service.serviceId}`} checked={formState.isRedeemingPoints} onCheckedChange={(checked) => handleRedeemPointsToggle(service.serviceId, !!checked)} disabled={!!formState.voucherCode || formState.appliedVoucherAmount > 0} /><Label htmlFor={`redeem-points-${service.serviceId}`} className="text-sm font-normal cursor-pointer flex items-center"><Gift className="h-4 w-4 mr-2 text-primary" />Tukarkan {formState.customerPoints || 0} Poin Anda</Label></div>
                           {formState.pointsMessage && (<p className={cn("text-xs mt-1", (formState.pointsDiscountAmount || 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>{formState.pointsMessage}</p>)}
                      </div>
                    </div>
                    {canTransact && service.powerOrVolume && allTokenSettings && (() => { const effectiveTokenType = service.tokenType.toUpperCase(); const settingsForPath = allTokenSettings[effectiveTokenType]?.[service.areaProject]?.[service.project]?.[service.vendorName]; let displayLabel = ''; let unit = ''; if (effectiveTokenType === 'ELECTRICITY' || effectiveTokenType === 'SOLAR') { displayLabel = 'Daya'; unit = effectiveTokenType === 'ELECTRICITY' ? 'KWh' : 'kWp'; } else if (effectiveTokenType === 'WATER' || effectiveTokenType === 'GAS') { displayLabel = 'Volume'; unit = 'm³'; } else { displayLabel = 'Info Layanan'; unit = 'Unit'; } let calculatedUnitValueDisplay: string | null = null; if (formState.calculatedPrice && formState.calculatedPrice.productAmount > 0 && settingsForPath) { const productAmount = formState.calculatedPrice.productAmount; const basePriceString = settingsForPath.basePrice; const basePriceNumeric = basePriceString ? parseInt(basePriceString.replace(/\D/g, ''), 10) : 0; if (basePriceNumeric > 0) { const rawCalculatedValue = productAmount / basePriceNumeric; calculatedUnitValueDisplay = rawCalculatedValue.toLocaleString('id-ID', { minimumFractionDigits: Number.isInteger(rawCalculatedValue) ? 0 : 2, maximumFractionDigits: 2 });}} if (displayLabel && service.powerOrVolume) { return (<div className="text-sm text-muted-foreground mt-4 mb-3 pt-3 border-t border-border/50"><span>{displayLabel}: {service.powerOrVolume}</span>{calculatedUnitValueDisplay !== null && (<><span className="mx-2">|</span><strong className="font-semibold text-muted-foreground">{calculatedUnitValueDisplay}</strong><span className="text-muted-foreground"> {unit}</span></>)}</div>);} return null; })()}
                    {formState.calculatedPrice && (<div className="bg-secondary/70 p-4 rounded-lg text-sm space-y-1 border border-border"><p className="font-semibold text-primary">Ringkasan Pembelian:</p><div className="flex justify-between"><span>Nominal Token:</span> <span className="font-medium">Rp {formState.calculatedPrice.productAmount.toLocaleString('id-ID')}</span></div><div className="flex justify-between"><span>Biaya Admin:</span> <span className="font-medium">Rp {formState.calculatedPrice.adminFee.toLocaleString('id-ID')}</span></div><div className="flex justify-between"><span>Pajak:{formState.calculatedPrice.taxAmount === 0 && formState.calculatedPrice.productAmount > 0 && (<span className="text-xs text-muted-foreground ml-1">(termasuk PPN)</span>)}</span><span className="font-medium">{formState.calculatedPrice.taxAmount > 0 ? `Rp ${formState.calculatedPrice.taxAmount.toLocaleString('id-ID')}` : (formState.calculatedPrice.productAmount > 0 ? 'Rp 0' : '-')}</span></div><div className="flex justify-between"><span>Biaya Lain:</span> <span className="font-medium">Rp {formState.calculatedPrice.otherCosts.toLocaleString('id-ID')}</span></div>{(formState.appliedVoucherAmount > 0 || (formState.pointsDiscountAmount || 0) > 0) && formState.calculatedPrice.originalTotalBeforeDiscount !== undefined && (<><div className="flex justify-between text-muted-foreground line-through"><span>Subtotal:</span> <span>Rp {formState.calculatedPrice.originalTotalBeforeDiscount.toLocaleString('id-ID')}</span></div>{formState.appliedVoucherAmount > 0 && (<div className="flex justify-between text-green-600 dark:text-green-400"><span>Diskon Voucher ({formState.voucherCode}):</span> <span>- Rp {formState.appliedVoucherAmount.toLocaleString('id-ID')}</span></div>)}{(formState.pointsDiscountAmount || 0) > 0 && (<div className="flex justify-between text-green-600 dark:text-green-400"><span>Diskon Poin:</span> <span>- Rp {(formState.pointsDiscountAmount || 0).toLocaleString('id-ID')}</span></div>)}</>)}<hr className="my-1 border-border" /><div className="flex justify-between font-bold text-base"><span className="text-primary">Total Bayar:</span> <span>Rp {formState.calculatedPrice.totalPayment.toLocaleString('id-ID')}</span></div></div>)}
                    <Button onClick={() => handlePurchase(service)} className="w-full text-base py-2.5 h-auto bg-primary hover:bg-primary/90 rounded-lg font-semibold mt-4" disabled={isPurchaseButtonDisabled}>{isCurrentServiceProcessing ? (<Loader2 className="mr-2 h-5 w-5 animate-spin" />) : (<CreditCard className="mr-2 h-5 w-5" />)}{isVendingToken === service.serviceId ? 'Memproses Token...' : (isProcessingPayment === service.serviceId ? 'Ke Pembayaran...' : 'Lanjutkan Pembayaran')}</Button></>)}</CardContent></AccordionContent>
              </Card>
            </AccordionItem>
          );
        })}
      </Accordion>

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
                    <p><strong>Jenis Token:</strong> {SERVICE_CONFIG_MAP[lastVendedToken.type.toUpperCase()]?.label || lastVendedToken.type}</p>
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


'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, limit, orderBy, addDoc, Timestamp, doc, getDoc as getFirestoreDoc } from 'firebase/firestore';
import type { CustomerData, AllTokenSettings, TokenSettingValues, CustomerService } from '@/types';
import { cn } from '@/lib/utils';
import { generateFullOrderId } from '@/lib/orderUtils';


const tokenFormSchema = z.object({
  customerSearchId: z.string().min(1, { message: 'ID Pelanggan harus dipilih dari sugesti.' }),
  customerName: z.string().min(1, { message: 'Nama Pelanggan harus terisi (pilih ID Pelanggan).' }),
  serviceId: z.string().min(1, { message: 'ID Layanan/No. Meter harus dipilih.' }),
  orderId: z.string().min(1, { message: 'ID Order gagal digenerate atau tidak valid.' }),
  amount: z.string()
    .min(1, { message: 'Nominal pembelian tidak boleh kosong.'})
    .transform((val) => val.replace(/\./g, ''))
    .refine(val => /^\d+$/.test(val) && val.length > 0, {
      message: 'Nominal harus berupa angka.',
    })
    .transform(val => parseInt(val, 10))
    .refine(val => !isNaN(val), {
      message: 'Nominal harus berupa angka yang valid.',
    })
    .refine(val => val >= 10000, {
      message: 'Nominal minimal adalah Rp 10.000.',
    })
    .refine(val => val <= 1000000, {
      message: 'Nominal maksimal adalah Rp 1.000.000.',
    })
    .refine(val => val % 5000 === 0, {
      message: 'Nominal harus kelipatan Rp 5.000.',
    }),
  generatedTokenCode: z.string().min(1, { message: 'Kode Token tidak valid atau belum digenerate.' }),
});

type TokenFormValues = z.infer<typeof tokenFormSchema>;

const tokenTypeDisplayMap: Record<string, string> = {
  ELECTRICITY: 'Listrik',
  WATER: 'Air',
  GAS: 'Gas',
  SOLAR: 'Solar',
  DEFAULT: 'Lainnya',
};

const tokenTypeUnitMap: Record<string, string> = {
  ELECTRICITY: 'KWh',
  WATER: 'm³',
  GAS: 'm³', // Atau MMBTU, tergantung konfigurasi basePrice
  SOLAR: 'kWp', // Atau KWh, tergantung konfigurasi basePrice
  DEFAULT: 'Unit',
};

const TOKEN_TYPES_FOR_SETTINGS_FETCH = ['ELECTRICITY', 'WATER', 'GAS', 'SOLAR'];

export function TokenForm() {
  const { toast } = useToast();
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerData[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isCustomerNameReadOnly, setIsCustomerNameReadOnly] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  const [allTokenSettings, setAllTokenSettings] = useState<AllTokenSettings | null>(null);
  const [isLoadingTokenSettings, setIsLoadingTokenSettings] = useState(true);
  const [tokenSettingsError, setTokenSettingsError] = useState<string | null>(null);
  const [calculatedUnitValueDisplay, setCalculatedUnitValueDisplay] = useState<string | null>(null);

  const popoverTriggerRef = useRef<HTMLButtonElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<TokenFormValues>({
    resolver: zodResolver(tokenFormSchema),
    defaultValues: {
      customerSearchId: '',
      customerName: '',
      serviceId: '',
      orderId: '',
      amount: '',
      generatedTokenCode: '',
    },
    mode: "onBlur",
  });

  const selectedServiceId = useWatch({
    control: form.control,
    name: 'serviceId',
  });

  const currentAmountValue = useWatch({
    control: form.control,
    name: 'amount',
  });
  
  const currentAmountString = typeof currentAmountValue === 'string' ? currentAmountValue : String(currentAmountValue || '');


  const generatedOrderIdValue = useWatch({
    control: form.control,
    name: 'orderId',
  });

  const generatedTokenCodeValue = form.watch('generatedTokenCode');

  const showGeneratedTokenField =
    generatedTokenCodeValue &&
    !['GAGAL_VENDING', 'ERROR_CLIENT_API_CALL'].includes(generatedTokenCodeValue) &&
    generatedTokenCodeValue.trim() !== '' &&
    !isGeneratingToken;


  useEffect(() => {
    const fetchAllTokenSettings = async () => {
      setIsLoadingTokenSettings(true);
      setTokenSettingsError(null);
      const loadedSettings: AllTokenSettings = {};
      try {
        for (const tokenName of TOKEN_TYPES_FOR_SETTINGS_FETCH) {
          const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);
          const settingsDocSnap = await getFirestoreDoc(settingsDocRef);
          if (settingsDocSnap.exists()) {
            const data = settingsDocSnap.data();
            if (data && data.settings && data.settings[tokenName]) {
              loadedSettings[tokenName] = data.settings[tokenName];
            } else {
              loadedSettings[tokenName] = {};
            }
          } else {
              loadedSettings[tokenName] = {};
          }
        }
        setAllTokenSettings(loadedSettings);
      } catch (err) {
        console.error("[TokenForm] Error fetching all token settings:", err);
        setTokenSettingsError("Gagal memuat konfigurasi harga token. Transaksi tidak dapat dilanjutkan.");
        toast({ title: "Error Konfigurasi", description: "Gagal memuat pengaturan harga token. Hubungi Admin.", variant: "destructive" });
        setAllTokenSettings({});
      } finally {
        setIsLoadingTokenSettings(false);
      }
    };
    fetchAllTokenSettings();
  }, [toast]);


 useEffect(() => {
    const generateAndSetOrderId = async () => {
      if (selectedServiceId && selectedCustomer) {
        const serviceDetails = selectedCustomer.services.find(s => s.serviceId === selectedServiceId);
        if (serviceDetails) {
          try {
            const newGeneratedOrderId = await generateFullOrderId(serviceDetails.tokenType, 'A');
            form.setValue('orderId', newGeneratedOrderId, { shouldValidate: true });
          } catch (error) {
            console.error("Failed to generate order ID:", error);
            toast({title: "Error ID Order", description: "Gagal men-generate ID Order unik.", variant: "destructive"});
            form.setValue('orderId', `TRN-A-ERR-${Date.now()}`, { shouldValidate: true });
          }
        } else {
          form.setValue('orderId', '', { shouldValidate: true });
        }
      } else {
        form.setValue('orderId', '', { shouldValidate: true });
      }
    };

    generateAndSetOrderId();
  }, [selectedServiceId, selectedCustomer, form, toast]);

  const normalizeSearchString = (str: string): string => {
    return str.toLowerCase().replace(/[-\s]/g, '');
  };

  const fetchCustomerSuggestions = useCallback(async (searchTerm: string) => {
    const normalizedInput = normalizeSearchString(searchTerm);
    if (normalizedInput.length < 3) {
      setCustomerSuggestions([]);
      if (isPopoverOpen && document.activeElement !== commandInputRef.current) {
          setIsPopoverOpen(false);
      }
      return;
    }

    setIsSuggestionsLoading(true);
    try {
      const customersRef = collection(db, 'customers');
      const firestoreQueryPrefix = searchTerm.substring(0,3).toUpperCase();

      const q = query(
        customersRef,
        orderBy('customerId'),
        where('customerId', '>=', firestoreQueryPrefix),
        where('customerId', '<=', firestoreQueryPrefix + '\uf8ff'),
        limit(30)
      );
      const querySnapshot = await getDocs(q);

      const allFetchedCustomers = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as CustomerData));

      const filteredSuggestions = allFetchedCustomers.filter(cust => {
        if (!cust.customerId) return false;
        const normalizedDbId = normalizeSearchString(cust.customerId);
        return normalizedDbId.startsWith(normalizedInput);
      }).slice(0, 7);

      setCustomerSuggestions(filteredSuggestions);

      if (document.activeElement === commandInputRef.current || (popoverTriggerRef.current && popoverTriggerRef.current.contains(document.activeElement))) {
         setIsPopoverOpen(true);
      } else if (filteredSuggestions.length === 0 && searchTerm.length >=3) {
         setIsPopoverOpen(true);
      } else if (filteredSuggestions.length > 0) {
         setIsPopoverOpen(true);
      } else {
         setIsPopoverOpen(false);
      }

    } catch (error) {
      console.error("Error fetching customer suggestions:", error);
      setCustomerSuggestions([]);
      setIsPopoverOpen(false);
      toast({ title: "Error", description: "Gagal mengambil sugesti pelanggan.", variant: "destructive" });
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [isPopoverOpen, toast]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (customerSearchValue && !isCustomerNameReadOnly) {
        fetchCustomerSuggestions(customerSearchValue);
      } else if (!customerSearchValue) {
        setCustomerSuggestions([]);
        setIsPopoverOpen(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [customerSearchValue, fetchCustomerSuggestions, isCustomerNameReadOnly]);

  const handleSuggestionSelect = (customer: CustomerData) => {
    form.setValue('customerSearchId', customer.customerId, { shouldValidate: true });
    form.setValue('customerName', customer.customerName, { shouldValidate: true });
    form.setValue('serviceId', '');
    form.setValue('orderId', '');
    form.setValue('amount', '');
    form.setValue('generatedTokenCode', '');
    setCustomerSearchValue(customer.customerId);
    setSelectedCustomer(customer);
    setIsPopoverOpen(false);
    setCustomerSuggestions([]);
    setIsCustomerNameReadOnly(true);
  };

  const handleCustomerSearchInputChange = (value: string) => {
    setCustomerSearchValue(value);
    form.setValue('customerSearchId', value, {shouldValidate: value.length > 0});

    if (value === '') {
      form.setValue('customerName', '');
      form.setValue('serviceId', '');
      form.setValue('orderId', '');
      form.setValue('amount', '');
      form.setValue('generatedTokenCode', '');
      setSelectedCustomer(null);
      setIsCustomerNameReadOnly(false);
    } else if (isCustomerNameReadOnly && selectedCustomer && value !== selectedCustomer.customerId) {
      form.setValue('customerName', '');
      form.setValue('serviceId', '');
      form.setValue('orderId', '');
      form.setValue('amount', '');
      form.setValue('generatedTokenCode', '');
      setSelectedCustomer(null);
      setIsCustomerNameReadOnly(false);
    }
  };

  const serviceDropdownOptions = useMemo(() => {
    if (!selectedCustomer || !selectedCustomer.services || selectedCustomer.services.length === 0) {
      return [];
    }

    const typeCounts: Record<string, number> = {};
    selectedCustomer.services.forEach(service => {
      const typeKey = service.tokenType.toUpperCase();
      typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
    });

    const typeIndices: Record<string, number> = {};

    return selectedCustomer.services.map(service => {
      const serviceTypeKey = service.tokenType.toUpperCase();
      const baseTypeDisplay = tokenTypeDisplayMap[serviceTypeKey] || tokenTypeDisplayMap.DEFAULT;
      let finalTypeDisplay = baseTypeDisplay;

      if (typeCounts[serviceTypeKey] > 1) {
        typeIndices[serviceTypeKey] = (typeIndices[serviceTypeKey] || 0) + 1;
        finalTypeDisplay = `${baseTypeDisplay} #${typeIndices[serviceTypeKey]}`;
      }

      return {
        value: service.serviceId,
        label: `${service.serviceId} (${finalTypeDisplay})`,
        tokenType: serviceTypeKey
      };
    });
  }, [selectedCustomer]);

  useEffect(() => {
    if (!selectedServiceId || !currentAmountString || !allTokenSettings || !selectedCustomer) {
      setCalculatedUnitValueDisplay(null);
      return;
    }

    const validationResult = tokenFormSchema.shape.amount.safeParse(currentAmountString);
    if (!validationResult.success || validationResult.data <= 0) {
      setCalculatedUnitValueDisplay(null);
      return;
    }
    const numericAmount = validationResult.data;

    const serviceDetails = selectedCustomer.services.find(s => s.serviceId === selectedServiceId);
    if (!serviceDetails) {
      setCalculatedUnitValueDisplay(null);
      return;
    }

    const { tokenType, areaProject, project, vendorName } = serviceDetails;
    const settingsKey = tokenType.toUpperCase();

    const basePriceStr = allTokenSettings[settingsKey]?.[areaProject]?.[project]?.[vendorName]?.basePrice;
    if (!basePriceStr) {
      setCalculatedUnitValueDisplay("Unit tidak dapat dihitung (harga dasar tidak ditemukan).");
      return;
    }

    const basePrice = parseInt(basePriceStr.replace(/\D/g, ''), 10);
    if (isNaN(basePrice) || basePrice <= 0) {
      setCalculatedUnitValueDisplay("Unit tidak dapat dihitung (harga dasar tidak valid/nol).");
      return;
    }

    const rawUnitValue = numericAmount / basePrice;
    const unitDisplay = tokenTypeUnitMap[settingsKey] || tokenTypeUnitMap.DEFAULT;
    setCalculatedUnitValueDisplay(`${rawUnitValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unitDisplay}`);

  }, [selectedServiceId, currentAmountString, allTokenSettings, selectedCustomer, form]);

  const handleGenerateTokenApi = async () => {
    const formData = form.getValues();
    const { serviceId, amount: amountStr } = formData;

    if (isLoadingTokenSettings) {
      toast({ title: "Mohon Tunggu", description: "Pengaturan token sedang dimuat. Harap tunggu sebentar.", variant: "default" });
      return;
    }
    if (tokenSettingsError || !allTokenSettings) {
      toast({ title: "Error Konfigurasi", description: tokenSettingsError || "Pengaturan token tidak tersedia.", variant: "destructive" });
      return;
    }

    if (!serviceId || !amountStr) {
      toast({ title: "Input Tidak Lengkap", description: "Pilih ID Layanan/No. Meter dan isi Nominal Pembelian.", variant: "destructive" });
      return;
    }

    const validationResult = tokenFormSchema.shape.amount.safeParse(amountStr);
    if (!validationResult.success) {
        toast({ title: "Nominal Tidak Valid", description: validationResult.error.errors[0]?.message || "Periksa kembali nominal pembelian.", variant: "destructive" });
        return;
    }
    const amountForApi = validationResult.data;

    setIsGeneratingToken(true);
    form.setValue('generatedTokenCode', '');

    let generatedTokenFromApi = '';

    try {
      const apiResponse = await fetch('/api/vend-stronpower-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meterId: serviceId, amount: amountForApi.toString() }),
      });

      const responseData = await apiResponse.json();

      if (apiResponse.ok && responseData.success && responseData.token) {
        generatedTokenFromApi = responseData.token;
        form.setValue('generatedTokenCode', generatedTokenFromApi, { shouldValidate: true });
        toast({ title: "Token Berhasil Digenerate", description: `Token: ${generatedTokenFromApi}` });
      } else {
        console.error("Token vending failed. Response from /api/vend-stronpower-token:", responseData);
        const errorMessage = responseData.message || "Terjadi kesalahan saat menghubungi API Stronpower.";
        toast({ title: "Gagal Generate Token", description: errorMessage, variant: "destructive" });
        form.setValue('generatedTokenCode', 'GAGAL_VENDING', { shouldValidate: false });
        setIsGeneratingToken(false);
        return;
      }
    } catch (error: any) {
      console.error("Error calling /api/vend-stronpower-token:", error);
      toast({ title: "Error API Client", description: error.message || "Gagal menghubungi server untuk generate token.", variant: "destructive" });
      form.setValue('generatedTokenCode', 'ERROR_CLIENT_API_CALL', { shouldValidate: false });
      setIsGeneratingToken(false);
      return;
    }

    if (generatedTokenFromApi && generatedTokenFromApi !== 'GAGAL_VENDING' && generatedTokenFromApi !== 'ERROR_CLIENT_API_CALL') {
      const serviceDetails = selectedCustomer?.services.find(s => s.serviceId === formData.serviceId);
      const tokenTypeForDb = serviceDetails ? serviceDetails.tokenType.toLowerCase() : 'unknown';
      const numericAmount = amountForApi;

      let basePriceForTx: number | undefined;
      let unitValueForTx: string | undefined;

      if (serviceDetails && allTokenSettings) {
        const settingsKey = serviceDetails.tokenType.toUpperCase();
        const areaKey = serviceDetails.areaProject;
        const projectKey = serviceDetails.project;
        const vendorKey = serviceDetails.vendorName;

        const basePriceStr = allTokenSettings[settingsKey]?.[areaKey]?.[projectKey]?.[vendorKey]?.basePrice;
        if (basePriceStr) {
          basePriceForTx = parseInt(basePriceStr.replace(/\D/g, ''), 10);
          if (!isNaN(basePriceForTx) && basePriceForTx > 0) {
            const rawUnitValue = numericAmount / basePriceForTx;
            unitValueForTx = rawUnitValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          }
        }
      }

      try {
        await addDoc(collection(db, 'generated_tokens'), {
          customerId: formData.customerSearchId,
          customerName: formData.customerName,
          serviceId: formData.serviceId,
          orderId: formData.orderId,
          type: tokenTypeForDb,
          amount: numericAmount,
          generatedTokenCode: generatedTokenFromApi,
          createdAt: Timestamp.now(),
          basePrice: basePriceForTx,
          unitValue: unitValueForTx,
        });
        toast({
          title: 'Token Digenerate & Disimpan!',
          description: `Token ${generatedTokenFromApi} untuk Pelanggan ${formData.customerName} (ID: ${formData.customerSearchId}) dengan Order ID ${formData.orderId} (Tipe: ${tokenTypeForDb}, Nominal: Rp ${numericAmount.toLocaleString('id-ID')}) telah disimpan. Unit Value: ${unitValueForTx || 'N/A'}`,
        });
        form.reset();
        setCustomerSearchValue('');
        setSelectedCustomer(null);
        setIsCustomerNameReadOnly(false);
        form.setValue('orderId', '');
        form.setValue('amount', '');
        form.setValue('generatedTokenCode', '');
        setCalculatedUnitValueDisplay(null);
      } catch (dbError) {
        console.error("Error saving generated token to Firestore:", dbError);
        toast({ title: "Error Penyimpanan DB", description: "Token berhasil digenerate tapi gagal disimpan ke database. Catat token secara manual.", variant: "destructive" });
      }
    }
    setIsGeneratingToken(false);
  };


  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-8">

        <FormItem>
          <FormLabel>No. ID Pelanggan (Ketik untuk mencari)</FormLabel>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild ref={popoverTriggerRef}>
              <div className="relative w-full">
                 <Input
                    placeholder="Ketik min. 3 karakter ID Pelanggan..."
                    className="w-full"
                    value={customerSearchValue}
                    onChange={(e) => handleCustomerSearchInputChange(e.target.value)}
                    onFocus={() => {
                        if (customerSearchValue.length >= 3 && !isCustomerNameReadOnly) {
                            fetchCustomerSuggestions(customerSearchValue);
                        }
                    }}
                    aria-autocomplete="list"
                    aria-controls="customer-suggestions-list"
                  />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <Command shouldFilter={false} >
                <CommandInput
                  ref={commandInputRef}
                  placeholder="Cari ID Pelanggan..."
                  value={customerSearchValue}
                  onValueChange={(currentValue) => {
                    handleCustomerSearchInputChange(currentValue);
                  }}
                  onFocusCapture={() => {
                     if (customerSearchValue.length >=3 && !isCustomerNameReadOnly) {
                         fetchCustomerSuggestions(customerSearchValue);
                     }
                  }}
                />
                <CommandList id="customer-suggestions-list">
                  {isSuggestionsLoading && (
                    <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mencari...
                    </div>
                  )}
                  {!isSuggestionsLoading && customerSuggestions.length === 0 && customerSearchValue.length >= 3 && (
                    <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                  )}
                  {!isSuggestionsLoading && customerSuggestions.length > 0 && (
                    <CommandGroup heading="Pilih Pelanggan:">
                      {customerSuggestions.map((cust) => (
                        <CommandItem
                          key={cust.id}
                          value={`${cust.customerId} - ${cust.customerName}`}
                          onSelect={() => handleSuggestionSelect(cust)}
                          className="cursor-pointer"
                        >
                          {cust.customerId} - <span className="ml-2 text-muted-foreground text-xs">{cust.customerName}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {form.formState.errors.customerSearchId && <FormMessage>{form.formState.errors.customerSearchId.message}</FormMessage>}
        </FormItem>

        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Pelanggan</FormLabel>
              <FormControl>
                <Input
                  placeholder="Nama akan terisi otomatis jika ID dipilih"
                  {...field}
                  readOnly={isCustomerNameReadOnly}
                  className={cn(isCustomerNameReadOnly && "bg-muted/70 cursor-not-allowed")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="serviceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID Layanan/No. Meter</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue('amount', '');
                  form.setValue('generatedTokenCode', '');
                  setCalculatedUnitValueDisplay(null);
                }}
                value={field.value}
                disabled={!selectedCustomer || !selectedCustomer.services || selectedCustomer.services.length === 0}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedCustomer ? "Pilih ID Pelanggan dulu" :
                      (serviceDropdownOptions.length > 0 ? "Pilih ID Layanan/No. Meter" : "Pelanggan tidak memiliki layanan terdaftar")
                    } />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {serviceDropdownOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Pilih ID layanan spesifik milik pelanggan.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {generatedOrderIdValue && (
          <div className="space-y-1">
            <FormLabel className="text-sm font-medium">ID Order</FormLabel>
            <p className="text-sm h-10 flex items-center px-3 py-2 rounded-md border border-input bg-muted/70 text-muted-foreground">
              {generatedOrderIdValue}
            </p>
             <p className="text-xs text-green-600 dark:text-green-500">
              *otomatis oleh sistem
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nominal Pembelian (Rp)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g., 10.000"
                  value={field.value}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    const cleanedValue = rawValue.replace(/\D/g, '');
                    if (cleanedValue === '') {
                        field.onChange('');
                    } else {
                        const numericValue = parseInt(cleanedValue, 10);
                        if (!isNaN(numericValue)) {
                            const displayCap = 1000000;
                            const valueToFormat = numericValue > displayCap && cleanedValue.length <= 7 ? numericValue : (numericValue > displayCap ? displayCap : numericValue) ;
                             field.onChange(valueToFormat.toLocaleString('id-ID'));
                        } else {
                           field.onChange(rawValue);
                        }
                    }
                  }}
                 onBlur={(e) => {
                    const currentDisplayValue = e.target.value;
                    form.trigger('amount');
                    if (!form.formState.errors.amount && currentDisplayValue) {
                        const cleaned = currentDisplayValue.replace(/\D/g, '');
                        if (cleaned) {
                           // Re-validate if needed or just let schema handle it
                        }
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                  className="appearance-none [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  disabled={!selectedServiceId || isSuggestionsLoading || isGeneratingToken || isLoadingTokenSettings || !!tokenSettingsError}
                />
              </FormControl>
              {calculatedUnitValueDisplay && (
                <FormDescription className="text-green-600 dark:text-green-500 font-medium">
                  Estimasi Value: {calculatedUnitValueDisplay}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {showGeneratedTokenField && (
          <FormField
            control={form.control}
            name="generatedTokenCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kode Token</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Kode token hasil generate"
                    {...field}
                    readOnly
                    className="bg-muted/70 cursor-not-allowed"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-4">
            <Button
                type="button"
                variant="default"
                onClick={handleGenerateTokenApi}
                disabled={isGeneratingToken || !selectedServiceId || !currentAmountValue || !!form.getFieldState('amount').error || isLoadingTokenSettings || !!tokenSettingsError}
                className="w-full"
            >
                {isGeneratingToken || isLoadingTokenSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoadingTokenSettings ? 'Memuat Pengaturan...' : 'Transaksi Token via API & Simpan'}
            </Button>
        </div>
        {tokenSettingsError && <p className="text-sm text-destructive text-center">{tokenSettingsError}</p>}
      </form>
    </Form>
  );
}


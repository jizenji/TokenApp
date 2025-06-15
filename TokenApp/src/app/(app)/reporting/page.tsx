
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2, ArrowLeft, ArrowRight, Search, Copy, Trash2, Info, Building, Briefcase, Store as StoreIcon } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs, Timestamp, limit, startAfter, DocumentData, endBefore, limitToLast, where, QueryConstraint, doc, deleteDoc, getDoc } from 'firebase/firestore'; // Added getDoc here
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { GeneratedToken as OriginalGeneratedToken, CustomerData, AllTokenSettings, CustomerService, TokenSettingValues } from '@/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE = 10;

interface EnrichedGeneratedToken extends OriginalGeneratedToken {
  customerName?: string;
  serviceDetails?: CustomerService;
  basePrice?: number;
  unitValue?: number | string; 
}

const tokenTypeDisplayMap: Record<string, { name: string }> = {
  ELECTRICITY: { name: 'Listrik' },
  WATER: { name: 'Air' },
  GAS: { name: 'Gas' },
  SOLAR: { name: 'Solar' },
  UNKNOWN: { name: 'Tidak Diketahui' },
};

export default function ReportingPage() {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<EnrichedGeneratedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTokenSettings, setIsLoadingTokenSettings] = useState(true);
  const [allTokenSettings, setAllTokenSettings] = useState<AllTokenSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentData | null>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<DocumentData | null>(null);
  const [isFetchingPage, setIsFetchingPage] = useState(false);
  const [hasMoreNext, setHasMoreNext] = useState(true);

  const [tokenTypeFilter, setTokenTypeFilter] = useState<string>('all');
  const [orderIdFilter, setOrderIdFilter] = useState<string>('');
  const [customerNameFilter, setCustomerNameFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [vendorFilter, setVendorFilter] = useState<string>('all');

  const [availableAreas, setAvailableAreas] = useState<string[]>(['all']);
  const [availableProjects, setAvailableProjects] = useState<string[]>(['all']);
  const [availableVendors, setAvailableVendors] = useState<string[]>(['all']);

  const [areaSummary, setAreaSummary] = useState<Record<string, number>>({});
  const [projectSummary, setProjectSummary] = useState<Record<string, number>>({});
  const [vendorSummary, setVendorSummary] = useState<Record<string, number>>({});
  const [totalDisplayedTransactions, setTotalDisplayedTransactions] = useState(0);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTransactionForDetail, setSelectedTransactionForDetail] = useState<EnrichedGeneratedToken | null>(null);
  const [customerPhoneNumberForWhatsApp, setCustomerPhoneNumberForWhatsApp] = useState<string | null>(null);
  const [isFetchingCustomerPhone, setIsFetchingCustomerPhone] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<EnrichedGeneratedToken | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);


  const fetchAllTokenSettings = useCallback(async () => {
    console.log('[ReportingPage] fetchAllTokenSettings START');
    setIsLoadingTokenSettings(true);
    setError(null);
    const loadedSettings: AllTokenSettings = {};
    const tokenTypeNamesForSettings = ['ELECTRICITY', 'WATER', 'GAS', 'SOLAR'];
    try {
      for (const tokenName of tokenTypeNamesForSettings) {
        const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);
        const settingsDocSnap = await getDoc(settingsDocRef);
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
      console.log('[ReportingPage] fetchAllTokenSettings END, allTokenSettings:', JSON.stringify(loadedSettings));

      const areas = new Set<string>();
      const projects = new Set<string>();
      const vendors = new Set<string>();
      Object.values(loadedSettings).forEach(tokenTypeSettings => {
        Object.entries(tokenTypeSettings).forEach(([areaName, projectSettings]) => {
          areas.add(areaName);
          Object.entries(projectSettings).forEach(([projectName, vendorSettings]) => {
            projects.add(projectName);
            Object.keys(vendorSettings).forEach(vendorName => vendors.add(vendorName));
          });
        });
      });
      setAvailableAreas(['all', ...Array.from(areas).sort()]);
      setAvailableProjects(['all', ...Array.from(projects).sort()]);
      setAvailableVendors(['all', ...Array.from(vendors).sort()]);

    } catch (err: any) {
      console.error("[ReportingPage] Error fetching all token settings:", err);
      setError("Gagal memuat konfigurasi harga token. Beberapa fitur mungkin tidak berfungsi.");
      setAllTokenSettings({});
    } finally {
      setIsLoadingTokenSettings(false);
    }
  }, []);

  useEffect(() => {
    console.log('[ReportingPage] Initial useEffect to load token settings.');
    fetchAllTokenSettings();
  }, [fetchAllTokenSettings]);

  const fetchTransactions = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    console.log(`[ReportingPage] fetchTransactions START - Direction: ${direction}, Current Page: ${currentPage}`);
    setIsFetchingPage(true);
    if (direction === 'first') {
      setLastVisibleDoc(null);
      setFirstVisibleDoc(null);
    }

    console.log('[ReportingPage] fetchTransactions TRY block started.');
    try {
      const tokensCollectionRef = collection(db, 'generated_tokens');
      const queryConstraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

      if (tokenTypeFilter !== 'all') {
        queryConstraints.push(where('type', '==', tokenTypeFilter.toLowerCase()));
      }
      if (orderIdFilter.trim() !== '') {
        queryConstraints.push(where('orderId', '==', orderIdFilter.trim()));
      }
      
      let q;
      if (direction === 'first') {
        q = query(tokensCollectionRef, ...queryConstraints, limit(ITEMS_PER_PAGE));
      } else if (direction === 'next' && lastVisibleDoc) {
        q = query(tokensCollectionRef, ...queryConstraints, startAfter(lastVisibleDoc), limit(ITEMS_PER_PAGE));
      } else if (direction === 'prev' && firstVisibleDoc) {
        q = query(tokensCollectionRef, ...queryConstraints, endBefore(firstVisibleDoc), limitToLast(ITEMS_PER_PAGE));
      } else {
        console.warn(`[ReportingPage] fetchTransactions: Invalid direction or missing doc for ${direction}. Defaulting to first page.`);
        q = query(tokensCollectionRef, ...queryConstraints, limit(ITEMS_PER_PAGE));
        setCurrentPage(1); 
        setLastVisibleDoc(null);
        setFirstVisibleDoc(null);
      }
      
      console.log('[ReportingPage] Executing Firestore query...');
      const querySnapshot = await getDocs(q);
      console.log(`[ReportingPage] Firestore query executed. Docs count: ${querySnapshot.docs.length}`);

      const rawTokensData = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(0),
        } as OriginalGeneratedToken;
      });

      console.log(`[ReportingPage] Raw tokens count to process: ${rawTokensData.length}`);
      const enrichedTokens: EnrichedGeneratedToken[] = [];
      console.log('[ReportingPage] Starting token enrichment...');

      for (const tokenData of rawTokensData) {
        console.log(`[ReportingPage] Enrich LOOP START for token ID: ${tokenData.id}, customerId: ${tokenData.customerId}, serviceId: ${tokenData.serviceId}, type: ${tokenData.type}`);
        let customerName: string | undefined;
        let serviceDetailsForToken: CustomerService | undefined;
        let basePrice: number | undefined;
        let unitValue: number | string | undefined;

        try {
          if (tokenData.customerId) {
            const customerQuery = query(collection(db, 'customers'), where('customerId', '==', tokenData.customerId), limit(1));
            console.log(`[ReportingPage] Enrich: Fetching customer data for customerId: ${tokenData.customerId}`);
            const customerSnapshot = await getDocs(customerQuery);
            console.log(`[ReportingPage] Enrich: Customer query done. Found: ${!customerSnapshot.empty}`);
            
            if (!customerSnapshot.empty) {
              const customer = customerSnapshot.docs[0].data() as CustomerData;
              customerName = customer.customerName;
              console.log(`[ReportingPage] Enrich: Found customer "${customerName}" for customerId "${tokenData.customerId}"`);

              console.log(`[ReportingPage] Enrich: Checking services for customer "${customerName}". Services data:`, customer.services);
              if (customer.services && Array.isArray(customer.services) && customer.services.length > 0) {
                console.log(`[ReportingPage] Enrich: Customer has ${customer.services.length} services. Looking for match...`);
                serviceDetailsForToken = customer.services.find(s => {
                  console.log(`[ReportingPage] Enrich DEBUG: Comparing service.tokenType="${s.tokenType?.toLowerCase() || 'undefined_service_type'}" with token.type="${tokenData.type?.toLowerCase() || 'undefined_token_type'}", service.serviceId="${s.serviceId}" with token.serviceId="${tokenData.serviceId}"`);
                  return s.tokenType?.toLowerCase() === tokenData.type?.toLowerCase() && s.serviceId === tokenData.serviceId;
                });

                if (serviceDetailsForToken) {
                  console.log(`[ReportingPage] Enrich: Found serviceDetails: Area=${serviceDetailsForToken.areaProject}, Project=${serviceDetailsForToken.project}, Vendor=${serviceDetailsForToken.vendorName}`);
                  if (allTokenSettings && serviceDetailsForToken.tokenType && serviceDetailsForToken.areaProject && serviceDetailsForToken.project && serviceDetailsForToken.vendorName) {
                    const settingsKeyForTokenType = serviceDetailsForToken.tokenType.toUpperCase();
                    const areaKey = serviceDetailsForToken.areaProject;
                    const projectKey = serviceDetailsForToken.project;
                    const vendorKey = serviceDetailsForToken.vendorName;
                    console.log(`[ReportingPage] Enrich: Looking for basePrice at path: ${settingsKeyForTokenType}.${areaKey}.${projectKey}.${vendorKey}`);

                    const basePriceStr = allTokenSettings[settingsKeyForTokenType]?.[areaKey]?.[projectKey]?.[vendorKey]?.basePrice;
                    console.log(`[ReportingPage] Enrich: Found basePriceStr: "${basePriceStr}"`);
                    if (basePriceStr) {
                      basePrice = parseInt(basePriceStr.replace(/\D/g, ''), 10);
                      if (!isNaN(basePrice) && basePrice > 0 && tokenData.amount) {
                        const rawUnitValue = tokenData.amount / basePrice;
                        unitValue = rawUnitValue.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        console.log(`[ReportingPage] Enrich: Calculated for token ${tokenData.id}: basePrice=${basePrice}, unitValue=${unitValue}`);
                      } else {
                        console.warn(`[ReportingPage] Enrich: basePrice is invalid or token amount missing for token ${tokenData.id}. basePriceStr: ${basePriceStr}, tokenData.amount: ${tokenData.amount}`);
                      }
                    } else {
                       console.warn(`[ReportingPage] Enrich: basePriceStr not found for token ${tokenData.id} at path ${settingsKeyForTokenType}.${areaKey}.${projectKey}.${vendorKey}`);
                    }
                  } else {
                    console.warn(`[ReportingPage] Enrich: Missing data for basePrice lookup (allTokenSettings, tokenType, area, project, or vendor) for token ${tokenData.id}`);
                  }
                } else {
                  console.warn(`[ReportingPage] Enrich: ServiceDetails for token ${tokenData.id} (serviceId: ${tokenData.serviceId}, type: ${tokenData.type}) NOT FOUND in customer ${customerName}'s services. Available services:`, customer.services?.map(s => ({sid: s.serviceId, type: s.tokenType})));
                }
              } else {
                console.warn(`[ReportingPage] Enrich: Customer ${customerName} (ID: ${tokenData.customerId}) has no services array or it's empty. Structure of services:`, customer.services);
              }
            } else {
              console.warn(`[ReportingPage] Enrich: Customer data not found for customerId: ${tokenData.customerId}`);
            }
          }
        } catch (enrichError: any) {
          console.error(`[ReportingPage] Enrich ERROR for token ID ${tokenData.id}:`, enrichError.message);
        }
        
        enrichedTokens.push({
          ...tokenData,
          customerName,
          serviceDetails: serviceDetailsForToken,
          basePrice,
          unitValue,
        });
        console.log(`[ReportingPage] Enrich LOOP END for token ID: ${tokenData.id}`);
      }
      console.log('[ReportingPage] Token enrichment loop FINISHED.');

      let clientFilteredTokens = enrichedTokens;
      if (customerNameFilter.trim() !== '') {
        clientFilteredTokens = clientFilteredTokens.filter(t => t.customerName?.toLowerCase().includes(customerNameFilter.toLowerCase()));
      }
      if (areaFilter !== 'all') {
        clientFilteredTokens = clientFilteredTokens.filter(t => t.serviceDetails?.areaProject === areaFilter);
      }
      if (projectFilter !== 'all') {
        clientFilteredTokens = clientFilteredTokens.filter(t => t.serviceDetails?.project === projectFilter);
      }
      if (vendorFilter !== 'all') {
        clientFilteredTokens = clientFilteredTokens.filter(t => t.serviceDetails?.vendorName === vendorFilter);
      }

      setReportData(clientFilteredTokens);
      setTotalDisplayedTransactions(clientFilteredTokens.length);

      const tempAreaSummary: Record<string, number> = {};
      const tempProjectSummary: Record<string, number> = {};
      const tempVendorSummary: Record<string, number> = {};
      clientFilteredTokens.forEach(token => {
        if (token.serviceDetails?.areaProject) {
          tempAreaSummary[token.serviceDetails.areaProject] = (tempAreaSummary[token.serviceDetails.areaProject] || 0) + 1;
        }
        if (token.serviceDetails?.project) {
          tempProjectSummary[token.serviceDetails.project] = (tempProjectSummary[token.serviceDetails.project] || 0) + 1;
        }
        if (token.serviceDetails?.vendorName) {
          tempVendorSummary[token.serviceDetails.vendorName] = (tempVendorSummary[token.serviceDetails.vendorName] || 0) + 1;
        }
      });
      setAreaSummary(tempAreaSummary);
      setProjectSummary(tempProjectSummary);
      setVendorSummary(tempVendorSummary);
      
      if (querySnapshot.docs.length > 0) {
        setFirstVisibleDoc(querySnapshot.docs[0]);
        setLastVisibleDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMoreNext(rawTokensData.length === ITEMS_PER_PAGE);
      } else {
        setFirstVisibleDoc(null);
        setLastVisibleDoc(null);
        setHasMoreNext(false);
      }
    } catch (err: any) {
      console.error("[ReportingPage] Error in fetchTransactions's TRY block:", err);
      setError("Gagal memuat data transaksi. Silakan coba lagi.");
      toast({ title: "Error Pengambilan Data", description: err.message || "Gagal mengambil data transaksi.", variant: "destructive" });
      setReportData([]);
    } finally {
      console.log(`[ReportingPage] fetchTransactions FINALLY block started - Direction: ${direction}.`);
      setIsFetchingPage(false);
      if (direction === 'first') {
        console.log('[ReportingPage] FINALLY - Setting isLoading to false (direction was first).');
        setIsLoading(false);
      }
      console.log('[ReportingPage] fetchTransactions FINALLY block finished.');
    }
  }, [
      allTokenSettings, 
      currentPage, 
      firstVisibleDoc, 
      lastVisibleDoc, 
      toast, 
      tokenTypeFilter, 
      orderIdFilter, 
      customerNameFilter, 
      areaFilter, 
      projectFilter, 
      vendorFilter
  ]);

  useEffect(() => {
    console.log('[ReportingPage] Effect for fetchTransactions triggered. isLoadingTokenSettings:', isLoadingTokenSettings, 'Error state:', error, 'allTokenSettings loaded:', !!allTokenSettings);
    if (isLoadingTokenSettings) {
      console.log('[ReportingPage] Waiting: Token settings are still loading.');
      setIsLoading(true);
      return;
    }
    if (error) { 
      console.log('[ReportingPage] Error state active (from token settings load). Aborting transaction fetch.');
      setIsLoading(false);
      setReportData([]); 
      return;
    }
    if (!allTokenSettings) {
      console.log('[ReportingPage] Waiting: allTokenSettings is null/undefined. Aborting transaction fetch.');
      setIsLoading(true);
      return;
    }
    console.log('[ReportingPage] Conditions met: Fetching transactions (first page).');
    setIsLoading(true);
    fetchTransactions('first');
  }, [
      isLoadingTokenSettings,
      error, 
      allTokenSettings,
      tokenTypeFilter, 
      orderIdFilter, 
      customerNameFilter, 
      areaFilter, 
      projectFilter, 
      vendorFilter,
      fetchTransactions 
  ]);


  useEffect(() => {
    const fetchPhone = async () => {
        if (isDetailDialogOpen && selectedTransactionForDetail?.customerId) {
            setIsFetchingCustomerPhone(true);
            setCustomerPhoneNumberForWhatsApp(null); 
            const customerBusinessId = selectedTransactionForDetail.customerId;
            console.log(`[ReportingPage] WhatsApp: Attempting to fetch phone for customer BUSINESS ID: ${customerBusinessId}`);
            try {
                const customersQuery = query(collection(db, "customers"), where("customerId", "==", customerBusinessId), limit(1));
                const customerSnapshot = await getDocs(customersQuery);

                if (!customerSnapshot.empty) {
                    const customerData = customerSnapshot.docs[0].data() as CustomerData;
                    console.log(`[ReportingPage] WhatsApp: Found customer data for business ID ${customerBusinessId}, phone: ${customerData.customerPhone}`);
                    setCustomerPhoneNumberForWhatsApp(customerData.customerPhone || null);
                } else {
                    console.warn(`[ReportingPage] WhatsApp: Customer data not found for business ID ${customerBusinessId}.`);
                }
            } catch (fetchError) {
                console.error("[ReportingPage] WhatsApp: Error fetching customer phone by business ID:", fetchError);
            } finally {
                setIsFetchingCustomerPhone(false);
            }
        }
    };
    fetchPhone();
  }, [isDetailDialogOpen, selectedTransactionForDetail]);

  const handleNextPage = () => {
    if (hasMoreNext) {
      setCurrentPage(prev => prev + 1);
      fetchTransactions('next');
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      fetchTransactions('prev');
    } else {
      fetchTransactions('first');
    }
  };
  
  const handleApplyFilters = () => {
    setCurrentPage(1); 
    fetchTransactions('first');
  };
  
  const openDetailDialog = (transaction: EnrichedGeneratedToken) => {
    setSelectedTransactionForDetail(transaction);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingTransaction(true);
    try {
      await deleteDoc(doc(db, 'generated_tokens', transactionToDelete.id));
      toast({ title: "Transaksi Dihapus", description: `Transaksi dengan ID Order ${transactionToDelete.orderId} telah berhasil dihapus.` });
      setTransactionToDelete(null);
      setIsDetailDialogOpen(false); 
      fetchTransactions('first'); 
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      toast({ title: "Gagal Menghapus", description: err.message || "Tidak dapat menghapus transaksi.", variant: "destructive" });
    } finally {
      setIsDeletingTransaction(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Berhasil Disalin", description: "Kode token telah disalin ke clipboard." }))
      .catch(err => toast({ title: "Gagal Menyalin", description: "Tidak dapat menyalin kode token.", variant: "destructive" }));
  };

  const formatPhoneNumberForWhatsApp = (phone: string | undefined | null): string | null => {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (!cleaned.startsWith('62') && cleaned.length >= 9 && cleaned.length <= 13) {
      cleaned = '62' + cleaned;
    }
    if (cleaned.startsWith('62') && cleaned.length >= 10 && cleaned.length <= 15) {
      return cleaned;
    }
    return null;
  };
  
  const sendWhatsAppMessage = () => {
    if (!selectedTransactionForDetail || !customerPhoneNumberForWhatsApp) return;
    const formattedPhone = formatPhoneNumberForWhatsApp(customerPhoneNumberForWhatsApp);
    if (!formattedPhone) {
      toast({ title: "Nomor Tidak Valid", description: "Nomor telepon pelanggan tidak valid untuk WhatsApp.", variant: "destructive" });
      return;
    }

    const tokenInfo = tokenTypeDisplayMap[selectedTransactionForDetail.type.toUpperCase()] || { name: selectedTransactionForDetail.type };
    const message = `Halo ${selectedTransactionForDetail.customerName || 'Pelanggan'},\nBerikut adalah detail token ${tokenInfo.name} Anda:\nNominal: Rp ${selectedTransactionForDetail.amount.toLocaleString('id-ID')}\nID Layanan: ${selectedTransactionForDetail.serviceId}\nToken: ${selectedTransactionForDetail.generatedTokenCode}\n\nTerima kasih telah bertransaksi!`;
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const renderSummarySection = (title: string, summaryData: Record<string, number>, Icon: React.ElementType) => {
    const entries = Object.entries(summaryData).sort(([, a], [, b]) => b - a); 
    if (entries.length === 0) return null;

    return (
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <Icon className="mr-2 h-5 w-5 text-primary" />
            Ringkasan per {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-32">
            <ul className="space-y-1 text-sm">
              {entries.map(([key, count]) => (
                <li key={key} className="flex justify-between">
                  <span>{key}:</span>
                  <span className="font-semibold">{count} trx</span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Laporan Transaksi Token</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Daftar transaksi token yang telah di-generate dan di-enrich dengan detail layanan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label htmlFor="tokenTypeFilterBasic" className="text-sm font-medium">Filter Jenis Token</Label>
              <Select value={tokenTypeFilter} onValueChange={(value) => setTokenTypeFilter(value)}>
                <SelectTrigger id="tokenTypeFilterBasic">
                  <SelectValue placeholder="Pilih jenis token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  {Object.entries(tokenTypeDisplayMap)
                    .filter(([key]) => key !== 'UNKNOWN')
                    .map(([key, { name }]) => (
                    <SelectItem key={key} value={key.toLowerCase()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
             <div>
              <Label htmlFor="orderIdFilter" className="text-sm font-medium">Filter ID Order</Label>
              <div className="relative">
                <Input id="orderIdFilter" placeholder="Ketik ID Order..." value={orderIdFilter} onChange={(e) => setOrderIdFilter(e.target.value)} className="pr-8"/>
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
             <div>
              <Label htmlFor="customerNameFilter" className="text-sm font-medium">Filter Nama Pelanggan</Label>
              <div className="relative">
                <Input id="customerNameFilter" placeholder="Ketik Nama Pelanggan..." value={customerNameFilter} onChange={(e) => setCustomerNameFilter(e.target.value)} className="pr-8"/>
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div>
                <Label htmlFor="areaFilter" className="text-sm font-medium">Filter Area Project</Label>
                <Select value={areaFilter} onValueChange={setAreaFilter}>
                    <SelectTrigger id="areaFilter"><SelectValue placeholder="Pilih Area" /></SelectTrigger>
                    <SelectContent>
                        {availableAreas.map(area => <SelectItem key={area} value={area}>{area === 'all' ? 'Semua Area' : area}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="projectFilter" className="text-sm font-medium">Filter Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter} disabled={areaFilter === 'all' && availableProjects.length <=1 }>
                    <SelectTrigger id="projectFilter"><SelectValue placeholder="Pilih Project" /></SelectTrigger>
                    <SelectContent>
                        {availableProjects.map(proj => <SelectItem key={proj} value={proj}>{proj === 'all' ? 'Semua Project' : proj}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="vendorFilter" className="text-sm font-medium">Filter Vendor</Label>
                <Select value={vendorFilter} onValueChange={setVendorFilter} disabled={(areaFilter === 'all' && projectFilter === 'all') && availableVendors.length <=1}>
                    <SelectTrigger id="vendorFilter"><SelectValue placeholder="Pilih Vendor" /></SelectTrigger>
                    <SelectContent>
                        {availableVendors.map(vend => <SelectItem key={vend} value={vend}>{vend === 'all' ? 'Semua Vendor' : vend}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="md:col-span-3 flex justify-end">
                <Button onClick={handleApplyFilters} disabled={isFetchingPage || isLoading || isLoadingTokenSettings} className="w-full md:w-auto">
                 Terapkan Semua Filter & Muat Ulang
               </Button>
            </div>
          </div>

          {isLoading ? (
             <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Memuat data laporan...</p>
            </div>
          ) : error ? (
            <div className="text-destructive text-center py-8">{error}</div>
          ) : (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                Menampilkan {totalDisplayedTransactions} transaksi. Halaman {currentPage}.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {renderSummarySection("Area Project", areaSummary, Building)}
                {renderSummarySection("Project", projectSummary, Briefcase)}
                {renderSummarySection("Vendor", vendorSummary, StoreIcon)}
              </div>
              {reportData.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>ID Order</TableHead>
                        <TableHead>ID Pelanggan</TableHead>
                        <TableHead>Nama Pelanggan</TableHead>
                        <TableHead>Jenis Token</TableHead>
                        <TableHead className="text-right">Nominal (Rp)</TableHead>
                        <TableHead className="text-right">Unit Token</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{item.orderId}</TableCell>
                          <TableCell>{item.customerId}</TableCell>
                          <TableCell>{item.customerName || '-'}</TableCell>
                          <TableCell>
                             {(tokenTypeDisplayMap[item.type.toUpperCase()]?.name || item.type)}
                          </TableCell>
                          <TableCell className="text-right">{item.amount.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right">{item.unitValue || (item.basePrice ? '-' : 'N/A')}</TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" onClick={() => openDetailDialog(item)}>
                                <Info className="mr-1 h-3.5 w-3.5" /> Detail
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Tidak ada transaksi ditemukan {(tokenTypeFilter !== 'all' || orderIdFilter || customerNameFilter || areaFilter !== 'all' || projectFilter !== 'all' || vendorFilter !== 'all') ? 'untuk filter yang diterapkan.' : 'saat ini.'}
                </p>
              )}

              {(currentPage > 1 || hasMoreNext) && reportData.length > 0 && (
                <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
                  <Button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || isFetchingPage}
                    variant="outline"
                    size="sm"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4"/> Sebelumnya
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Halaman {currentPage}
                  </span>
                  <Button
                    onClick={handleNextPage}
                    disabled={!hasMoreNext || isFetchingPage}
                    variant="outline"
                    size="sm"
                  >
                    Berikutnya <ArrowRight className="ml-1 h-4 w-4"/>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedTransactionForDetail && (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Detail Transaksi Token</DialogTitle>
                    <DialogDescription>ID Order: {selectedTransactionForDetail.orderId}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-3">
                    <div className="space-y-3 py-2 text-sm">
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Tanggal:</span><span className="col-span-2">{selectedTransactionForDetail.createdAt.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">ID Pelanggan:</span><span className="col-span-2">{selectedTransactionForDetail.customerId}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Nama Pelanggan:</span><span className="col-span-2">{selectedTransactionForDetail.customerName || '-'}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">ID Layanan:</span><span className="col-span-2">{selectedTransactionForDetail.serviceId}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Jenis Token:</span><span className="col-span-2">{(tokenTypeDisplayMap[selectedTransactionForDetail.type.toUpperCase()]?.name || selectedTransactionForDetail.type)}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Nominal (Rp):</span><span className="col-span-2">{selectedTransactionForDetail.amount.toLocaleString('id-ID')}</span></div>
                        
                        {selectedTransactionForDetail.serviceDetails && (
                          <>
                            <div className="grid grid-cols-3 gap-2 pt-2 border-t"><span className="font-medium text-muted-foreground">Area Project:</span><span className="col-span-2">{selectedTransactionForDetail.serviceDetails.areaProject}</span></div>
                            <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Project:</span><span className="col-span-2">{selectedTransactionForDetail.serviceDetails.project}</span></div>
                            <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Vendor:</span><span className="col-span-2">{selectedTransactionForDetail.serviceDetails.vendorName}</span></div>
                          </>
                        )}
                        
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Base Price (Rp):</span><span className="col-span-2">{selectedTransactionForDetail.basePrice ? selectedTransactionForDetail.basePrice.toLocaleString('id-ID') : '-'}</span></div>
                        <div className="grid grid-cols-3 gap-2"><span className="font-medium text-muted-foreground">Unit Token:</span><span className="col-span-2">{selectedTransactionForDetail.unitValue || '-'}</span></div>
                        
                        <div className="grid grid-cols-3 gap-2 items-center pt-2 border-t">
                          <span className="font-medium text-muted-foreground">Kode Token:</span>
                          <div className="col-span-2 flex items-center space-x-1.5">
                            <span className="font-mono text-base bg-muted px-2 py-1 rounded">{selectedTransactionForDetail.generatedTokenCode}</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(selectedTransactionForDetail.generatedTokenCode)}>
                                <Copy className="h-4 w-4" />
                                <span className="sr-only">Salin Kode Token</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-7 w-7",
                                customerPhoneNumberForWhatsApp && formatPhoneNumberForWhatsApp(customerPhoneNumberForWhatsApp) 
                                  ? "text-green-600 hover:text-green-700 hover:bg-green-100 dark:text-green-500 dark:hover:bg-green-900/50" 
                                  : "text-muted-foreground cursor-not-allowed opacity-50"
                              )}
                              onClick={sendWhatsAppMessage}
                              disabled={isFetchingCustomerPhone || !customerPhoneNumberForWhatsApp || !formatPhoneNumberForWhatsApp(customerPhoneNumberForWhatsApp)}
                              title={isFetchingCustomerPhone ? "Mencari nomor telepon..." : (customerPhoneNumberForWhatsApp ? "Kirim via WhatsApp" : "Nomor telepon pelanggan tidak tersedia")}
                            >
                                {isFetchingCustomerPhone ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.33 3.42 16.79L2.05 22L7.31 20.63C8.72 21.39 10.33 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.27 20.83 6.82 18.91 4.91C17 3.01 14.61 2 12.04 2M12.04 3.88C16.52 3.88 20.07 7.42 20.07 11.91C20.07 16.4 16.52 19.94 12.04 19.94C10.53 19.94 9.11 19.56 7.91 18.89L7.52 18.67L4.56 19.55L5.45 16.68L5.22 16.29C4.47 14.98 4.01 13.48 4.01 11.91C4.01 7.42 7.56 3.88 12.04 3.88M17.44 14.84C17.33 14.73 16.52 14.32 16.34 14.25C16.16 14.18 16.03 14.14 15.91 14.32C15.78 14.5 15.31 15.03 15.17 15.17C15.03 15.31 14.89 15.33 14.64 15.23C14.39 15.12 13.49 14.81 12.43 13.89C11.61 13.19 11.03 12.32 10.89 12.07C10.75 11.82 10.85 11.71 10.97 11.59C11.08 11.49 11.23 11.31 11.35 11.17C11.47 11.03 11.53 10.91 11.63 10.73C11.73 10.55 11.67 10.41 11.61 10.29C11.55 10.18 11.02 8.86 10.79 8.31C10.56 7.76 10.33 7.82 10.17 7.81C10.01 7.81 9.86 7.81 9.71 7.81C9.56 7.81 9.32 7.87 9.12 8.24C8.92 8.61 8.24 9.29 8.24 10.55C8.24 11.81 9.14 13.02 9.26 13.17C9.38 13.31 10.95 15.64 13.29 16.59C13.85 16.83 14.29 16.97 14.61 17.07C15.14 17.23 15.64 17.19 16.03 17.12C16.47 17.04 17.26 16.57 17.42 16.13C17.58 15.68 17.58 15.31 17.52 15.17C17.47 15.04 17.55 14.95 17.44 14.84Z"></path></svg>
                                }
                            </Button>
                          </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="pt-4 flex-col sm:flex-row gap-2">
                    <Button variant="destructive" onClick={() => setTransactionToDelete(selectedTransactionForDetail)} className="w-full sm:w-auto" disabled={isDeletingTransaction}>
                        {isDeletingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Trash2 className="mr-2 h-4 w-4" /> Hapus Transaksi Ini
                    </Button>
                    <DialogClose asChild>
                        <Button variant="outline" className="w-full sm:w-auto">Tutup</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {transactionToDelete && (
        <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Hapus Transaksi</AlertDialogTitle>
              <AlertDialogDescription>
                Anda yakin ingin menghapus transaksi dengan ID Order &quot;{transactionToDelete.orderId}&quot; (Kode Token: {transactionToDelete.generatedTokenCode})? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTransactionToDelete(null)} disabled={isDeletingTransaction}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive hover:bg-destructive/90" disabled={isDeletingTransaction}>
                {isDeletingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ya, Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

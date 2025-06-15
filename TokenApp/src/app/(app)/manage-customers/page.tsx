

'use client';

import { useAuth } from '@/hooks/use-auth';
import { UserRole, type CustomerData, type AreaHierarchy, type AreaInHierarchy, type ProjectInArea, type VendorInProject, type CustomerService as CustomerServiceType, type VendorData } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Trash2, Users, Search, Loader2, Eye, EyeOff, Info, CheckCircle2, AlertTriangle, Settings2, Zap, Droplet, Flame, Sun, MinusCircle, Save, ShieldCheck, ShieldOff, PlayCircle, PauseCircle, Ban, CircleCheck, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { db } from '@/config/firebase';
import { getDoc, doc, collection, getDocs, query, where, orderBy, Timestamp, serverTimestamp, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CustomerServiceFormData extends CustomerServiceType {
  tempId?: string;
  isUISaved?: boolean;
  isServiceTransactionActive?: boolean; 
  powerOrVolume?: string;
}

interface CustomerFormData {
  customerKTP: string;
  customerId: string;
  customerName: string;
  customerUsername: string;
  customerPassword?: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  services: CustomerServiceFormData[];
  isTransactionActive: boolean;
}

const initialCustomerFormState: CustomerFormData = {
  customerKTP: '',
  customerId: '',
  customerName: '',
  customerUsername: '',
  customerPassword: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  services: [],
  isTransactionActive: true,
};

const TOKEN_TYPES_FOR_CUSTOMER_SERVICES = [
  { id: 'ELECTRICITY', label: 'Listrik', icon: Zap, code: 'L' },
  { id: 'WATER', label: 'Air', icon: Droplet, code: 'A' },
  { id: 'GAS', label: 'Gas', icon: Flame, code: 'G' },
  { id: 'SOLAR', label: 'Solar', icon: Sun, code: 'S' },
];

const serviceBgColors: Record<string, string> = {
  ELECTRICITY: 'bg-yellow-50 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800/60',
  WATER: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60',
  GAS: 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800/60',
  SOLAR: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/60',
  DEFAULT: 'bg-muted/30 border-border',
};

const serviceHeaderColors: Record<string, string> = {
  ELECTRICITY: 'text-yellow-700 dark:text-yellow-400',
  WATER: 'text-blue-700 dark:text-blue-400',
  GAS: 'text-red-700 dark:text-red-400',
  SOLAR: 'text-orange-700 dark:text-orange-400',
  DEFAULT: 'text-foreground',
};

const serviceBannerBgColors: Record<string, string> = {
  ELECTRICITY: 'bg-yellow-100 dark:bg-yellow-800/30 border-yellow-300 dark:border-yellow-700/50 text-yellow-800 dark:text-yellow-200',
  WATER: 'bg-blue-100 dark:bg-blue-800/30 border-blue-300 dark:border-blue-700/50 text-blue-800 dark:text-blue-200',
  GAS: 'bg-red-100 dark:bg-red-800/30 border-red-300 dark:border-red-700/50 text-red-800 dark:text-red-200',
  SOLAR: 'bg-orange-100 dark:bg-orange-800/30 border-orange-300 dark:border-orange-700/50 text-orange-800 dark:text-orange-200',
  DEFAULT: 'bg-green-100 dark:bg-green-800/30 border-green-300 dark:border-green-700/50 text-green-800 dark:text-green-200',
};


const isServiceConfigValid = (service: Partial<CustomerServiceFormData>): boolean => {
  return !!(service.serviceId && service.powerOrVolume && service.tokenType && service.areaProject && service.project && service.vendorName);
};

const isServiceValidForDB = (service: CustomerServiceType, hierarchiesData: Record<string, AreaHierarchy>, globalVendorsList: VendorData[]): boolean => {
  if (!service.serviceId || !service.powerOrVolume || !service.tokenType || !service.areaProject || !service.project || !service.vendorName) {
    return false;
  }
  const tokenHierarchy = hierarchiesData[service.tokenType];
  if (!tokenHierarchy || !Array.isArray(tokenHierarchy)) {
    return false;
  }
  const areaData = tokenHierarchy.find((area: AreaInHierarchy) => area && area.name === service.areaProject);
  if (!areaData || !Array.isArray(areaData.projects)) {
    return false;
  }
  const projectData = areaData.projects.find((proj: ProjectInArea) => proj && proj.name === service.project);
  if (!projectData || !Array.isArray(projectData.vendors)) {
    return false;
  }
  const vendorInHierarchy = projectData.vendors.some((vendor: VendorInProject) => vendor && vendor.name === service.vendorName);
  if (!vendorInHierarchy) return false;

  const globalVendor = globalVendorsList.find(v => v.name === service.vendorName);
  if (!globalVendor || !Array.isArray(globalVendor.handledServices) || !globalVendor.handledServices.includes(service.tokenType)) {
    return false;
  }
  return true;
};

const getCustomerOverallStatus = (customer: CustomerData, hierarchiesData: Record<string, AreaHierarchy>, globalVendorsList: VendorData[]): 'Valid' | 'Error' | 'Perlu Konfigurasi' => {
   if (!customer.customerId || customer.customerId.startsWith('PENDING-')) {
    return 'Perlu Konfigurasi';
  }
  if (!customer.services || customer.services.length === 0) {
    return 'Perlu Konfigurasi';
  }

  let hasAtLeastOneValidService = false;
  for (const service of customer.services) {
    if (!isServiceValidForDB(service, hierarchiesData, globalVendorsList)) {
      return 'Error';
    }
    hasAtLeastOneValidService = true;
  }

  return hasAtLeastOneValidService ? 'Valid' : 'Perlu Konfigurasi';
};

async function getNextCustomerIdSequence(monthYear: string, serviceCode: string): Promise<number> {
  const counterId = `customer_${monthYear}_${serviceCode}`;
  const counterRef = doc(db, "counters", counterId);

  try {
    let nextSequence = 1;
    const counterDoc = await getDoc(counterRef);
    if (counterDoc.exists()) {
        const currentSequence = counterDoc.data()?.lastSequence || 0;
        nextSequence = currentSequence + 1;
    }
    await setDoc(counterRef, { lastSequence: nextSequence, updatedAt: serverTimestamp() }, { merge: true });
    return nextSequence;

  } catch (error) {
    console.error("Error in getNextCustomerIdSequence operation (non-transactional):", error);
    return Math.floor(Math.random() * 10000); 
  }
}

function generateRandomAlphanumeric(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const maskKtp = (ktpWithFormat: string): string => {
  const digits = ktpWithFormat.replace(/\D/g, '');
  if (digits.length <= 4) { 
    return digits.length > 0 ? `XXXX - XXXX - XXXX - ${digits.padEnd(4, 'X')}` : 'XXXX - XXXX - XXXX - XXXX';
  }
  const lastFour = digits.slice(-4);
  return `XXXX - XXXX - XXXX - ${lastFour}`;
};

const formatPhoneNumberForWhatsApp = (phone: string | undefined | null): string | null => {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, ''); // Remove non-digits
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (!cleaned.startsWith('62') && cleaned.length >= 9 && cleaned.length <= 13) { // Typical Indonesian length after '0' removal
    cleaned = '62' + cleaned;
  }
  
  // Check if it looks like a valid Indonesian WhatsApp number
  if (cleaned.startsWith('62') && cleaned.length >= 10 && cleaned.length <= 15) { 
    return cleaned;
  }
  return null; // Not a clearly valid/Indonesian format for WhatsApp
};


export default function ManageCustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<CustomerData[]>([]);

  const [isCustomerFormDialogOpen, setIsCustomerFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);

  const [customerFormData, setCustomerFormData] = useState<CustomerFormData>(initialCustomerFormState);

  const [isDetailCustomerDialogOpen, setIsDetailCustomerDialogOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<CustomerData | null>(null);
  const [isSubmittingCustomer, setIsSubmittingCustomer] = useState(false);

  const [showPasswordInForm, setShowPasswordInForm] = useState(false);
  const [showDetailPassword, setShowDetailPassword] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerData | null>(null);

  const [isLoadingHierarchies, setIsLoadingHierarchies] = useState(true);
  const [allHierarchiesData, setAllHierarchiesData] = useState<Record<string, AreaHierarchy>>({});
  const [allGlobalVendors, setAllGlobalVendors] = useState<VendorData[]>([]);

  const [toastedErrorCustomerIds, setToastedErrorCustomerIds] = useState(new Set<string>());

  const [currentPage, setCurrentPage] = useState(1);
  const customersPerPage = 7;

  const [activeServiceDisplayType, setActiveServiceDisplayType] = useState<string | null>(null);
  const [activeServiceInstanceTabs, setActiveServiceInstanceTabs] = useState<Record<string, string>>({});
  
  const [statusFilter, setStatusFilter] = useState<'all' | 'Valid' | 'Error' | 'Perlu Konfigurasi'>('all');
  const [goToPageInput, setGoToPageInput] = useState<string>('');

  const [serviceInstanceToDelete, setServiceInstanceToDelete] = useState<{ tempId?: string; serviceId?: string; typeLabel: string; instanceNumber: number, tokenType?: string } | null>(null);

  const [isKtpVisibleInForm, setIsKtpVisibleInForm] = useState(false);
  const [showSupervisionPasswordDialog, setShowSupervisionPasswordDialog] = useState(false);
  const [supervisionPasswordInput, setSupervisionPasswordInput] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [supervisionAction, setSupervisionAction] = useState<{ type: 'deleteHierarchy' | 'viewKtp'; payload?: any } | null>(null);


  const vendorsCollectionRef = useMemo(() => collection(db, 'vendors'), []);
  const customersCollectionRef = useMemo(() => collection(db, 'customers'), []);

  useEffect(() => {
    const fetchSupportingData = async () => {
      setIsLoadingHierarchies(true);
      try {
        const loadedHierarchies: Record<string, AreaHierarchy> = {};
        const hierarchyPromises = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.map(async (tokenType) => {
          const hierarchyDocRef = doc(db, 'appConfiguration', `hierarchy_${tokenType.id}`);
          const hierarchyDocSnap = await getDoc(hierarchyDocRef);
          if (hierarchyDocSnap.exists()) {
            const hierarchyData = hierarchyDocSnap.data().hierarchy;
            loadedHierarchies[tokenType.id] = Array.isArray(hierarchyData) ? (hierarchyData as AreaHierarchy) : [];
          } else {
            loadedHierarchies[tokenType.id] = [];
          }
        });

        const vendorsQuery = query(vendorsCollectionRef, orderBy('name', 'asc'));
        const vendorsSnapshotPromise = getDocs(vendorsQuery);

        const [_, vendorsSnapshot] = await Promise.all([Promise.all(hierarchyPromises), vendorsSnapshotPromise]);

        setAllHierarchiesData(loadedHierarchies);

        const fetchedVendors = vendorsSnapshot.docs.map((docSnapshot) => {
          const vendorData = docSnapshot.data();
          return {
            ...vendorData,
            id: docSnapshot.id,
            registrationDate: (vendorData.registrationDate as Timestamp)?.toDate ? (vendorData.registrationDate as Timestamp).toDate() : new Date(),
            handledServices: vendorData.handledServices || [],
          } as VendorData;
        });
        setAllGlobalVendors(fetchedVendors);

      } catch (error) {
        console.error("Error fetching hierarchy or vendor data:", error);
        toast({ title: "Error Memuat Data Pendukung", description: (error as Error).message, variant: "destructive" });
      } finally {
        setIsLoadingHierarchies(false);
      }
    };

    const fetchCustomers = async () => {
        try {
            const q = query(customersCollectionRef, orderBy('customerName', 'asc'));
            const querySnapshot = await getDocs(q);
            const fetchedCustomers = querySnapshot.docs.map(docSnapshot => {
                const data = docSnapshot.data();
                return {
                    ...data,
                    id: docSnapshot.id,
                    customerRegistrationDate: (data.customerRegistrationDate as Timestamp)?.toDate ? (data.customerRegistrationDate as Timestamp).toDate() : new Date(),
                    services: Array.isArray(data.services) ? data.services.map(s => ({...s, isServiceTransactionActive: s.isServiceTransactionActive === undefined ? true : s.isServiceTransactionActive })) : [],
                    isTransactionActive: data.isTransactionActive === undefined ? true : data.isTransactionActive,
                } as CustomerData;
            });
            setCustomers(fetchedCustomers);
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast({ title: "Error Memuat Pelanggan", description: (error as Error).message, variant: "destructive" });
            setCustomers([]);
        }
    };

    if (user) {
        fetchSupportingData();
        fetchCustomers();
    }
  }, [toast, user, vendorsCollectionRef, customersCollectionRef]);


  useEffect(() => {
    if (isLoadingHierarchies || customers.length === 0 || Object.keys(allHierarchiesData).length === 0 || allGlobalVendors.length === 0) {
      return;
    }
    const newToastedIdsForThisRun = new Set<string>();
    customers.forEach(customer => {
      const status = getCustomerOverallStatus(customer, allHierarchiesData, allGlobalVendors);
      if (status === 'Error' && !toastedErrorCustomerIds.has(customer.id)) {
        toast({
          title: "Konfigurasi Layanan Pelanggan Tidak Valid",
          description: `Pelanggan "${customer.customerName}" (${customer.customerId || 'ID Belum Ada'}) memiliki satu atau lebih layanan dengan konfigurasi Daya/Volume, Area/Project/Vendor yang tidak valid, telah terhapus, atau vendor tidak menangani layanan tersebut. Perbaiki melalui tombol Edit.`,
          variant: "destructive",
          duration: 10000,
        });
        newToastedIdsForThisRun.add(customer.id);
      }
    });
    if (newToastedIdsForThisRun.size > 0) {
      setToastedErrorCustomerIds(prevToastedIds => new Set([...prevToastedIds, ...newToastedIdsForThisRun]));
    }
  }, [customers, allHierarchiesData, allGlobalVendors, isLoadingHierarchies, toast, toastedErrorCustomerIds]);


  const filteredCustomers = useMemo(() => {
    let tempCustomers = customers;

    if (searchTerm) {
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        tempCustomers = tempCustomers.filter(customer =>
            customer.customerName.toLowerCase().includes(lowercasedSearchTerm) ||
            (customer.customerEmail && customer.customerEmail.toLowerCase().includes(lowercasedSearchTerm)) ||
            (customer.customerId && customer.customerId.toLowerCase().includes(lowercasedSearchTerm)) ||
            (customer.services && customer.services.some(service =>
            service.areaProject?.toLowerCase().includes(lowercasedSearchTerm)
            ))
        );
    }
    if (statusFilter !== 'all') {
        tempCustomers = tempCustomers.filter(customer => {
            const status = getCustomerOverallStatus(customer, allHierarchiesData, allGlobalVendors);
            return status === statusFilter;
        });
    }
    return tempCustomers;
  }, [searchTerm, customers, statusFilter, allHierarchiesData, allGlobalVendors]);


  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, customers]);

  useEffect(() => {
    setGoToPageInput(String(currentPage));
  }, [currentPage]);

  const indexOfLastCustomer = currentPage * customersPerPage;
  const indexOfFirstCustomer = indexOfLastCustomer - customersPerPage;
  const currentCustomers = useMemo(() => {
      return filteredCustomers.slice(indexOfFirstCustomer, indexOfLastCustomer);
  }, [filteredCustomers, indexOfFirstCustomer, indexOfLastCustomer]);

  const totalPages = useMemo(() => {
      return Math.ceil(filteredCustomers.length / customersPerPage);
  }, [filteredCustomers.length, customersPerPage]);


  const handleCoreInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCustomerFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleKtpInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    let digits = inputValue.replace(/\D/g, '');
    digits = digits.substring(0, 16);

    let formattedKTP = '';
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedKTP += ' - ';
      }
      formattedKTP += digits[i];
    }
    setCustomerFormData(prev => ({ ...prev, customerKTP: formattedKTP }));
  };

  const addServiceInstanceByType = (tokenTypeToAdd: string) => {
    if (!tokenTypeToAdd) return;
    const newTempId = `new_service_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCustomerFormData(prev => ({
      ...prev,
      services: [
        ...(prev.services || []),
        {
          tempId: newTempId,
          serviceId: '',
          powerOrVolume: '', 
          tokenType: tokenTypeToAdd,
          areaProject: '',
          project: '',
          vendorName: '',
          serviceSpecificNotes: '',
          isUISaved: false,
          isServiceTransactionActive: true,
        }
      ]
    }));
    setActiveServiceInstanceTabs(prev => ({ ...prev, [tokenTypeToAdd]: newTempId }));
  };

  const removeServiceInstance = (tempIdToRemove?: string, serviceIdToRemove?: string, tokenTypeOfRemovedInstance?: string) => {
    setCustomerFormData(prev => {
        const updatedServices = (prev.services || []).filter(service =>
            tempIdToRemove ? service.tempId !== tempIdToRemove : service.serviceId !== serviceIdToRemove
        ).map(s => ({ ...s, isUISaved: s.isUISaved === true ? true : false }));

        if (tokenTypeOfRemovedInstance && activeServiceInstanceTabs[tokenTypeOfRemovedInstance] === (tempIdToRemove || serviceIdToRemove)) {
            const remainingServicesOfType = updatedServices.filter(s => s.tokenType === tokenTypeOfRemovedInstance);
            if (remainingServicesOfType.length > 0) {
                setActiveServiceInstanceTabs(st => ({
                    ...st,
                    [tokenTypeOfRemovedInstance]: remainingServicesOfType[0].tempId || remainingServicesOfType[0].serviceId!
                }));
            } else {
                setActiveServiceInstanceTabs(st => {
                    const newState = { ...st };
                    delete newState[tokenTypeOfRemovedInstance];
                    return newState;
                });
            }
        }
        return { ...prev, services: updatedServices };
    });
  };

  const handleServiceInstanceChange = (overallServiceIndex: number, field: keyof Omit<CustomerServiceFormData, 'tokenType' | 'tempId' | 'isUISaved' | 'isServiceTransactionActive'>, value: string) => {
    setCustomerFormData(prev => {
        const updatedServices = [...(prev.services || [])];
        if (updatedServices[overallServiceIndex]) {
            const serviceToUpdate = { ...updatedServices[overallServiceIndex] };

            (serviceToUpdate as any)[field] = value;
            serviceToUpdate.isUISaved = false;

            if (field === 'areaProject') {
                serviceToUpdate.project = '';
                serviceToUpdate.vendorName = '';
            } else if (field === 'project') {
                serviceToUpdate.vendorName = '';
            }
            updatedServices[overallServiceIndex] = serviceToUpdate;
        }
        return { ...prev, services: updatedServices };
    });
  };
  
  const handleServiceInstanceSwitchChange = (overallServiceIndex: number, field: 'isServiceTransactionActive', checked: boolean) => {
    setCustomerFormData(prev => {
        const updatedServices = [...(prev.services || [])];
        if (updatedServices[overallServiceIndex]) {
            updatedServices[overallServiceIndex] = {
                ...updatedServices[overallServiceIndex],
                [field]: checked,
                isUISaved: false, 
            };
        }
        return { ...prev, services: updatedServices };
    });
  };


  const handleSaveServiceTypeConfiguration = (serviceType: string) => {
    const typeConfig = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === serviceType);
    if (!typeConfig) return;

    const servicesOfType = customerFormData.services.filter(s => s.tokenType === serviceType);
    if (servicesOfType.length === 0) {
        toast({ title: `Tidak Ada Layanan ${typeConfig.label}`, description: `Tidak ada layanan ${typeConfig.label} untuk divalidasi. Klik "Tambah Layanan ${typeConfig.label} Baru" terlebih dahulu.`, variant: "default" });
        return;
    }

    let allValid = true;
    for (const service of servicesOfType) {
        if (!isServiceConfigValid(service)) {
            allValid = false;
            break;
        }
    }

    if (allValid) {
        setCustomerFormData(prev => ({
            ...prev,
            services: prev.services.map(s =>
                s.tokenType === serviceType ? { ...s, isUISaved: true } : s
            )
        }));
        toast({ title: `Layanan ${typeConfig.label} Tervalidasi`, description: `Semua konfigurasi untuk layanan ${typeConfig.label} telah berhasil divalidasi.` });
    } else {
        toast({ title: `Validasi Gagal untuk Layanan ${typeConfig.label}`, description: `Harap lengkapi semua ID Layanan, Daya/Volume, Area, Project, dan Vendor untuk semua layanan ${typeConfig.label}.`, variant: "destructive" });
    }
  };


  const getAvailableAreas = useCallback((tokenType: string): AreaInHierarchy[] => {
    return (allHierarchiesData[tokenType] || []) as AreaInHierarchy[];
  }, [allHierarchiesData]);

  const getAvailableProjects = useCallback((tokenType?: string, areaName?: string): ProjectInArea[] => {
    if (!tokenType || !areaName) return [];
    const hierarchy = allHierarchiesData[tokenType] || [];
    if (!Array.isArray(hierarchy)) return [];
    const area = (hierarchy as AreaInHierarchy[]).find((a: AreaInHierarchy) => a && a.name === areaName);
    return (area && Array.isArray(area.projects) ? area.projects : []) || [];
  }, [allHierarchiesData]);

  const getAvailableVendors = useCallback((tokenType?: string, areaName?: string, projectName?: string): VendorInProject[] => {
    if (!tokenType || !areaName || !projectName || !allGlobalVendors) return [];

    const projects = getAvailableProjects(tokenType, areaName);
    const projectInHierarchy = projects.find((proj: ProjectInArea) => proj && proj.name === projectName);

    if (!projectInHierarchy || !Array.isArray(projectInHierarchy.vendors)) {
        return [];
    }

    const vendorNamesInHierarchy = projectInHierarchy.vendors
      .map(v => (typeof v === 'object' && v !== null && typeof v.name === 'string' ? v.name : null))
      .filter((name): name is string => name !== null);

    return allGlobalVendors
        .filter(gv =>
            gv.name &&
            Array.isArray(gv.handledServices) &&
            gv.handledServices.includes(tokenType) &&
            vendorNamesInHierarchy.includes(gv.name)
        )
        .map(v => ({ name: v.name! }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [getAvailableProjects, allGlobalVendors]);


  const handleOpenAddDialog = () => {
    setFormMode('add');
    setEditingCustomerId(null);
    setCustomerFormData(initialCustomerFormState);
    setShowPasswordInForm(false);
    setActiveServiceDisplayType(null);
    setActiveServiceInstanceTabs({});
    setIsKtpVisibleInForm(false);
    setIsCustomerFormDialogOpen(true);
  };

  const handleOpenEditDialog = (customer: CustomerData) => {
    setFormMode('edit');
    setEditingCustomerId(customer.id);
    
    const servicesWithTempIds = (customer.services || []).map(s => ({
        ...s, 
        tempId: s.serviceId || `s_${Date.now()}_${Math.random().toString(36).substring(2,5)}_${s.tokenType}`,
        isUISaved: true, 
        isServiceTransactionActive: s.isServiceTransactionActive === undefined ? true : s.isServiceTransactionActive,
        powerOrVolume: s.powerOrVolume || '', 
    }));

    setCustomerFormData({
      customerKTP: customer.customerKTP,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerUsername: customer.customerUsername,
      customerPassword: '',
      customerEmail: customer.customerEmail,
      customerPhone: customer.customerPhone || '',
      customerAddress: customer.customerAddress || '',
      services: servicesWithTempIds,
      isTransactionActive: customer.isTransactionActive === undefined ? true : customer.isTransactionActive,
    });

    const initialTabsState: Record<string, string> = {};
    TOKEN_TYPES_FOR_CUSTOMER_SERVICES.forEach(typeInfo => {
        const servicesOfType = servicesWithTempIds.filter(s => s.tokenType === typeInfo.id);
        if (servicesOfType.length > 0 && servicesOfType[0].tempId) {
            initialTabsState[typeInfo.id] = servicesOfType[0].tempId;
        }
    });
    setActiveServiceInstanceTabs(initialTabsState);

    setShowPasswordInForm(false);
    setActiveServiceDisplayType(null);
    setIsKtpVisibleInForm(false);
    setIsCustomerFormDialogOpen(true);
  };

  const _executeSaveCustomer = async (preGeneratedCustomerId: string) => {
    setIsSubmittingCustomer(true);
    try {
      let passwordToSave = customerFormData.customerPassword;
      if (formMode === 'edit' && !customerFormData.customerPassword?.trim()) {
          const existingCustomer = customers.find(c => c.id === editingCustomerId);
          passwordToSave = existingCustomer?.customerPassword;
      }

      const firestoreDocId = formMode === 'add' ? doc(collection(db, 'customers')).id : editingCustomerId!;
      
      const customerToSaveFromForm: Omit<CustomerData, 'id' | 'customerRegistrationDate'> & { customerRegistrationDate: Timestamp | Date } = {
        customerKTP: customerFormData.customerKTP,
        customerId: preGeneratedCustomerId,
        customerName: customerFormData.customerName,
        customerUsername: customerFormData.customerUsername,
        customerPassword: passwordToSave,
        customerEmail: customerFormData.customerEmail,
        customerPhone: customerFormData.customerPhone,
        customerAddress: customerFormData.customerAddress,
        customerRegistrationDate: formMode === 'add' ? Timestamp.now() : customers.find(c=>c.id === editingCustomerId!)!.customerRegistrationDate,
        services: customerFormData.services.map(s => ({
          serviceId: s.serviceId!,
          powerOrVolume: s.powerOrVolume || '', 
          tokenType: s.tokenType!,
          areaProject: s.areaProject!,
          project: s.project!,
          vendorName: s.vendorName!,
          serviceSpecificNotes: s.serviceSpecificNotes,
          isServiceTransactionActive: s.isServiceTransactionActive === undefined ? true : s.isServiceTransactionActive,
        })),
        isTransactionActive: customerFormData.isTransactionActive,
      };

      const customerDocRef = doc(db, 'customers', firestoreDocId);
      await setDoc(customerDocRef, customerToSaveFromForm);

      let registrationDateForDisplay: Date;
      if (customerToSaveFromForm.customerRegistrationDate instanceof Timestamp) {
        registrationDateForDisplay = customerToSaveFromForm.customerRegistrationDate.toDate();
      } else if (customerToSaveFromForm.customerRegistrationDate instanceof Date) {
        registrationDateForDisplay = customerToSaveFromForm.customerRegistrationDate;
      } else {
         console.warn("customerRegistrationDate is not a Firestore Timestamp or JS Date for customer:", customerToSaveFromForm.customerId);
         registrationDateForDisplay = new Date(); 
      }

      const displayCustomer: CustomerData = {
        ...customerToSaveFromForm,
        id: firestoreDocId,
        customerRegistrationDate: registrationDateForDisplay,
      };

      const idMessagePart = displayCustomer.customerId ? ` (ID: ${displayCustomer.customerId})` : '';
      if (formMode === 'add') {
        setCustomers(prev => [displayCustomer, ...prev].sort((a, b) => a.customerName.localeCompare(b.customerName)));
        toast({ title: "Pelanggan Ditambahkan", description: `${displayCustomer.customerName}${idMessagePart} berhasil ditambahkan.` });
      } else if (formMode === 'edit' && editingCustomerId) {
        setCustomers(prev => prev.map(c =>
          c.id === editingCustomerId
            ? displayCustomer
            : c
        ).sort((a, b) => a.customerName.localeCompare(b.customerName)));
        toast({ title: "Pelanggan Diperbarui", description: `${displayCustomer.customerName}${idMessagePart} berhasil diperbarui.` });
        setToastedErrorCustomerIds(prev => {
          const updated = new Set(prev);
          updated.delete(editingCustomerId);
          return updated;
        });
      }

      setIsCustomerFormDialogOpen(false);
      setCustomerFormData(initialCustomerFormState);
      setShowPasswordInForm(false);
      setActiveServiceDisplayType(null);
      setIsKtpVisibleInForm(false);
    } catch (error) {
        console.error("Error saving customer to Firestore:", error);
        toast({ title: "Gagal Menyimpan Pelanggan", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSubmittingCustomer(false);
    }
  };

  const handleSaveCustomer = async () => {
    setIsSubmittingCustomer(true);
    const { customerKTP, customerName, customerUsername, customerPassword, customerEmail } = customerFormData;
    const rawKtpDigits = customerKTP.replace(/\D/g, '');

    if (formMode === 'add' && rawKtpDigits.length !== 16) {
       toast({ title: "Validasi Gagal", description: "No. KTP harus terdiri dari 16 digit.", variant: "destructive" });
       setIsSubmittingCustomer(false);
      return;
    }
    if (!customerName.trim() || !customerUsername.trim() || (formMode === 'add' && (!customerPassword || customerPassword.trim() === '')) || !customerEmail.trim()) {
      toast({ title: "Validasi Gagal", description: "Nama, Username, Email harus diisi. Password wajib untuk pelanggan baru.", variant: "destructive" });
      setIsSubmittingCustomer(false);
      return;
    }

    if (customerFormData.services.length > 0 && customerFormData.services.some(s => !s.isUISaved)) {
        toast({ title: "Validasi Layanan Gagal", description: "Harap validasi semua konfigurasi layanan (klik tombol 'Simpan Layanan [Jenis]') sebelum menyimpan pelanggan.", variant: "destructive" });
        setIsSubmittingCustomer(false);
        return;
    }

    let generatedCustomerId: string = '';

    try {
      if (formMode === 'add') {
          const ktpQuery = query(customersCollectionRef, where("customerKTP", "==", customerFormData.customerKTP));
          const ktpSnapshot = await getDocs(ktpQuery);
          if (!ktpSnapshot.empty) {
              toast({
                  title: "No. KTP Sudah Terdaftar",
                  description: "No. KTP yang Anda masukkan sudah digunakan oleh pelanggan lain. Masukkan No. KTP dengan benar.",
                  variant: "destructive",
                  duration: 7000,
              });
              setIsSubmittingCustomer(false);
              return;
          }

          if (customerFormData.services.length > 0) {
            const now = new Date();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const year = now.getFullYear().toString().slice(-2);
            const monthYear = `${month}${year}`;

            let serviceCode = 'X'; 
            if (customerFormData.services.length === 1) {
                const serviceTypeInfo = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === customerFormData.services[0].tokenType);
                serviceCode = serviceTypeInfo?.code || 'U'; 
            } else if (customerFormData.services.length > 1) {
                serviceCode = 'M'; 
            }

            const sequence = await getNextCustomerIdSequence(monthYear, serviceCode);
            const sequencePadded = sequence.toString().padStart(4, '0');
            generatedCustomerId = `SAI-${monthYear}-${serviceCode}-${sequencePadded}`;
          } else {
             generatedCustomerId = `PENDING-${generateRandomAlphanumeric(4)}`;
          }
      } else { 
        generatedCustomerId = customerFormData.customerId; 
        if (generatedCustomerId.startsWith('PENDING-') && customerFormData.services.length > 0) {
           const now = new Date();
           const month = (now.getMonth() + 1).toString().padStart(2, '0');
           const year = now.getFullYear().toString().slice(-2);
           const monthYear = `${month}${year}`;
           let serviceCode = 'X';
           if (customerFormData.services.length === 1) {
               const serviceTypeInfo = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === customerFormData.services[0].tokenType);
               serviceCode = serviceTypeInfo?.code || 'U';
           } else if (customerFormData.services.length > 1) {
               serviceCode = 'M';
           }
           const sequence = await getNextCustomerIdSequence(monthYear, serviceCode);
           const sequencePadded = sequence.toString().padStart(4, '0');
           generatedCustomerId = `SAI-${monthYear}-${serviceCode}-${sequencePadded}`;
           toast({ title: "ID Pelanggan Diperbarui", description: `ID PENDING telah diganti dengan ID baru: ${generatedCustomerId}`, duration: 7000 });
        } else if (generatedCustomerId && !generatedCustomerId.startsWith('PENDING-') && customerFormData.services.length === 0) {
           generatedCustomerId = `PENDING-${generateRandomAlphanumeric(4)}`;
           toast({ title: "ID Pelanggan Diperbarui", description: `Semua layanan telah dihapus. ID pelanggan diubah menjadi: ${generatedCustomerId}`, variant: "default", duration: 7000 });
        }
      }
      await _executeSaveCustomer(generatedCustomerId);

    } catch (error) {
        console.error("Error in handleSaveCustomer pre-save or KTP check:", error);
        toast({ title: "Gagal Memproses Permintaan", description: (error as Error).message, variant: "destructive" });
        setIsSubmittingCustomer(false); 
    }
  };

  const openDeleteConfirmDialog = (customer: CustomerData) => {
    setCustomerToDelete(customer);
  };

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    setIsSubmittingCustomer(true);
    try {
        await deleteDoc(doc(db, "customers", customerToDelete.id));
        setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
        toast({ title: "Pelanggan Dihapus", description: `Pelanggan ${customerToDelete.customerName} (ID: ${customerToDelete.customerId || 'Tanpa ID'}) berhasil dihapus.`, variant: "default" });
    } catch (error) {
        console.error("Error deleting customer:", error);
        toast({ title: "Gagal Menghapus", description: (error as Error).message, variant: "destructive" });
    } finally {
        setCustomerToDelete(null);
        setIsSubmittingCustomer(false);
    }
  };

  const openDetailDialog = (customer: CustomerData) => {
    setSelectedCustomerForDetail(customer);
    setShowDetailPassword(false);
    setIsDetailCustomerDialogOpen(true);
  };

  const isKtpCompleteForAdd = useMemo(() => {
    return formMode === 'add' && customerFormData.customerKTP.replace(/\D/g, '').length === 16;
  }, [customerFormData.customerKTP, formMode]);


  const isFormReadyForSubmission = useMemo(() => {
    const {
      customerKTP,
      customerName,
      customerUsername,
      customerPassword,
      customerEmail,
      services,
    } = customerFormData;

    if (formMode === 'add') {
      if (customerKTP.replace(/\D/g, '').length !== 16) return false;
      if (!customerPassword || customerPassword.trim() === '') return false;
    }

    const coreFieldsPopulated =
      customerName.trim() !== '' &&
      customerUsername.trim() !== '' &&
      customerEmail.trim() !== '';

    if (!coreFieldsPopulated) return false;

    return services.every(service => service.isUISaved === true);

  }, [customerFormData, formMode]);

  const handleToggleGlobalTransactionStatus = async (customer: CustomerData) => {
    setIsSubmittingCustomer(true);
    const newStatus = !(customer.isTransactionActive === undefined ? true : customer.isTransactionActive);
    try {
      const customerDocRef = doc(db, "customers", customer.id);
      await updateDoc(customerDocRef, { isTransactionActive: newStatus });
      
      const updatedCustomers = customers.map(c =>
        c.id === customer.id ? { ...c, isTransactionActive: newStatus } : c
      );
      setCustomers(updatedCustomers);

      if(selectedCustomerForDetail && selectedCustomerForDetail.id === customer.id) {
        setSelectedCustomerForDetail(prev => prev ? {...prev, isTransactionActive: newStatus} : null);
      }

      toast({
        title: "Status Transaksi Global Diperbarui",
        description: `Status transaksi global untuk ${customer.customerName} telah ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });
    } catch (error) {
      console.error("Error updating global transaction status:", error);
      toast({ title: "Gagal Memperbarui Status Global", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const handleToggleSpecificServiceTransactionStatus = async (customer: CustomerData, serviceIdToToggle: string) => {
    setIsSubmittingCustomer(true);
    const customerDocRef = doc(db, "customers", customer.id);
    
    const updatedServices = customer.services.map(service => {
      if (service.serviceId === serviceIdToToggle) {
        return { ...service, isServiceTransactionActive: !(service.isServiceTransactionActive === undefined ? true : service.isServiceTransactionActive) };
      }
      return service;
    });

    try {
      await updateDoc(customerDocRef, { services: updatedServices });
      
      const updatedCustomers = customers.map(c => 
        c.id === customer.id ? { ...c, services: updatedServices } : c
      );
      setCustomers(updatedCustomers);

      if(selectedCustomerForDetail && selectedCustomerForDetail.id === customer.id) {
          setSelectedCustomerForDetail(prev => prev ? {...prev, services: updatedServices} : null);
      }
      const targetService = updatedServices.find(s => s.serviceId === serviceIdToToggle);
      const serviceTypeInfo = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === targetService?.tokenType);

      toast({
        title: "Status Transaksi Layanan Diperbarui",
        description: `Status transaksi untuk layanan ${serviceTypeInfo?.label || 'Tidak Diketahui'} (ID: ${serviceIdToToggle}) milik ${customer.customerName} telah ${targetService?.isServiceTransactionActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
      });

    } catch (error) {
      console.error("Error updating specific service transaction status:", error);
      toast({ title: "Gagal Memperbarui Status Layanan", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSubmittingCustomer(false);
    }
  };

  const confirmRemoveServiceInstance = () => {
    if (serviceInstanceToDelete) {
        const { tempId, serviceId, typeLabel, instanceNumber, tokenType } = serviceInstanceToDelete;
        removeServiceInstance(tempId, serviceId, tokenType);
        toast({
            title: "Layanan Dihapus dari Form",
            description: `Layanan ${typeLabel} #${instanceNumber} telah dihapus dari daftar layanan pelanggan ini. Perubahan akan permanen setelah Anda menyimpan pelanggan.`,
            variant: "default"
        });
        setServiceInstanceToDelete(null);
    }
  };

  const PLACEHOLDER_SUPERVISION_PASSWORD = "admin123"; 

  const handleSupervisionPasswordConfirm = async () => {
    if (!supervisionAction) return;
    setIsVerifyingPassword(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    if (supervisionPasswordInput === PLACEHOLDER_SUPERVISION_PASSWORD) {
        if (supervisionAction.type === 'viewKtp') {
            setIsKtpVisibleInForm(true);
            toast({ title: "Akses Diberikan", description: "No. KTP sekarang ditampilkan." });
        } else if (supervisionAction.type === 'deleteHierarchy' && supervisionAction.payload) {
            toast({ title: "Password Supervisi Diterima", description: "Melanjutkan proses penghapusan..." });
            
            console.log("Supervision password correct for delete hierarchy action. Payload:", supervisionAction.payload);
            
        }
        setShowSupervisionPasswordDialog(false);
    } else {
        toast({ title: "Password Supervisi Salah", description: "Aksi dibatalkan. Silakan coba lagi.", variant: "destructive" });
    }
    setSupervisionPasswordInput('');
    setSupervisionAction(null);
    setIsVerifyingPassword(false);
  };


  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.TEKNISI)) {
    return (
      <Card className="shadow-xl m-4">
        <CardHeader><CardTitle>Akses Ditolak</CardTitle></CardHeader>
        <CardContent><p>Anda tidak memiliki izin untuk melihat halaman ini.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Users className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl font-bold tracking-tight">Kelola Data Pelanggan</CardTitle>
            </div>
            <CardDescription className="text-lg text-muted-foreground">
              Lihat, tambah, edit, atau hapus informasi detail pelanggan dan layanannya.
            </CardDescription>
          </div>
          <Button className="mt-4 md:mt-0" onClick={handleOpenAddDialog}>
            <PlusCircle className="mr-2 h-5 w-5" /> Tambah Pelanggan Baru
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Cari berdasarkan ID Pelanggan, nama, email, atau area project layanan..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="Valid">Valid</SelectItem>
                  <SelectItem value="Error">Error</SelectItem>
                  <SelectItem value="Perlu Konfigurasi">Perlu Konfigurasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>ID Pelanggan</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead className="text-center">Layanan</TableHead>
                  <TableHead className="w-[200px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHierarchies ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /> Memuat data...</TableCell></TableRow>
                ) : currentCustomers.length > 0 ? currentCustomers.map((customer) => {
                  const configStatus = getCustomerOverallStatus(customer, allHierarchiesData, allGlobalVendors);
                  const isGlobalTransactionActive = customer.isTransactionActive === undefined ? true : customer.isTransactionActive;
                  let deactivatedServiceCount = 0;
                  if (isGlobalTransactionActive && customer.services && customer.services.length > 0) {
                      deactivatedServiceCount = customer.services.filter(
                          s => (s.isServiceTransactionActive === undefined ? true : s.isServiceTransactionActive) === false
                      ).length;
                  }

                  return (
                  <TableRow key={customer.id} className={cn(!isGlobalTransactionActive && "bg-orange-50 dark:bg-orange-950/50")}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {configStatus === 'Valid' ? (
                          <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </Badge>
                        ) : configStatus === 'Error' ? (
                          <Badge variant="destructive" className="flex items-center gap-1 whitespace-nowrap">
                            <AlertTriangle className="h-3 w-3" /> Error
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 flex items-center gap-1 whitespace-nowrap">
                            <Settings2 className="h-3 w-3" /> Perlu Konfig
                          </Badge>
                        )}

                        {configStatus === 'Valid' && (
                            <>
                                {!isGlobalTransactionActive ? (
                                    <Badge variant="outline" className="border-orange-500 text-orange-600 dark:border-orange-400 dark:text-orange-400 flex items-center gap-1 whitespace-nowrap">
                                        <PauseCircle className="h-3 w-3" /> Trx Global Nonaktif
                                    </Badge>
                                ) : deactivatedServiceCount > 0 ? (
                                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-400 flex items-center gap-1 whitespace-nowrap">
                                        <MinusCircle className="h-3 w-3" /> {deactivatedServiceCount} Layanan Nonaktif
                                    </Badge>
                                ) : null}
                            </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell 
                      className={cn(
                        "font-medium",
                        customer.customerId && customer.customerId.startsWith('PENDING-') && "text-red-600 dark:text-red-500"
                      )}
                    >
                      {customer.customerId || 'Kosong'}
                    </TableCell>
                    <TableCell>{customer.customerName}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{customer.customerPhone || '-'}</span>
                        {customer.customerPhone && formatPhoneNumberForWhatsApp(customer.customerPhone) && (
                          <a
                            href={`https://wa.me/${formatPhoneNumberForWhatsApp(customer.customerPhone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Chat dengan ${customer.customerName} di WhatsApp`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "icon" }),
                              "h-7 w-7 border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-900/50"
                            )}
                            onClick={(e) => e.stopPropagation()} 
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.33 3.42 16.79L2.05 22L7.31 20.63C8.72 21.39 10.33 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.27 20.83 6.82 18.91 4.91C17 3.01 14.61 2 12.04 2M12.04 3.88C16.52 3.88 20.07 7.42 20.07 11.91C20.07 16.4 16.52 19.94 12.04 19.94C10.53 19.94 9.11 19.56 7.91 18.89L7.52 18.67L4.56 19.55L5.45 16.68L5.22 16.29C4.47 14.98 4.01 13.48 4.01 11.91C4.01 7.42 7.56 3.88 12.04 3.88M17.44 14.84C17.33 14.73 16.52 14.32 16.34 14.25C16.16 14.18 16.03 14.14 15.91 14.32C15.78 14.5 15.31 15.03 15.17 15.17C15.03 15.31 14.89 15.33 14.64 15.23C14.39 15.12 13.49 14.81 12.43 13.89C11.61 13.19 11.03 12.32 10.89 12.07C10.75 11.82 10.85 11.71 10.97 11.59C11.08 11.49 11.23 11.31 11.35 11.17C11.47 11.03 11.53 10.91 11.63 10.73C11.73 10.55 11.67 10.41 11.61 10.29C11.55 10.18 11.02 8.86 10.79 8.31C10.56 7.76 10.33 7.82 10.17 7.81C10.01 7.81 9.86 7.81 9.71 7.81C9.56 7.81 9.32 7.87 9.12 8.24C8.92 8.61 8.24 9.29 8.24 10.55C8.24 11.81 9.14 13.02 9.26 13.17C9.38 13.31 10.95 15.64 13.29 16.59C13.85 16.83 14.29 16.97 14.61 17.07C15.14 17.23 15.64 17.19 16.03 17.12C16.47 17.04 17.26 16.57 17.42 16.13C17.58 15.68 17.58 15.31 17.52 15.17C17.47 15.04 17.55 14.95 17.44 14.84Z"></path>
                            </svg>
                            <span className="sr-only">Chat WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{customer.services?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex space-x-1 md:space-x-1.5">
                        <Button variant="outline" size="icon" aria-label={`Detail pelanggan ${customer.customerName}`} onClick={() => openDetailDialog(customer)} disabled={isSubmittingCustomer}>
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" aria-label={`Edit pelanggan ${customer.customerName}`} onClick={() => handleOpenEditDialog(customer)} disabled={isSubmittingCustomer}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={isGlobalTransactionActive ? "outline" : "default"}
                          size="icon"
                          className={isGlobalTransactionActive ? "border-orange-500 text-orange-600 hover:bg-orange-100 hover:text-orange-700 dark:border-orange-400 dark:text-orange-400 dark:hover:bg-orange-900 dark:hover:text-orange-300" : "bg-green-500 hover:bg-green-600 text-white"}
                          aria-label={isGlobalTransactionActive ? `Nonaktifkan transaksi global ${customer.customerName}` : `Aktifkan transaksi global ${customer.customerName}`}
                          onClick={() => handleToggleGlobalTransactionStatus(customer)}
                          disabled={isSubmittingCustomer}
                        >
                          {isGlobalTransactionActive ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </Button>
                        <Button variant="destructive" size="icon" aria-label={`Hapus pelanggan ${customer.customerName}`} onClick={() => openDeleteConfirmDialog(customer)} disabled={isSubmittingCustomer}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                      {searchTerm || statusFilter !== 'all' ? "Tidak ada pelanggan yang cocok dengan filter Anda." : "Tidak ada pelanggan yang terdaftar."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isLoadingHierarchies}
                variant="outline"
                size="sm"
              >
                Sebelumnya
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Hal {currentPage} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const pageNum = parseInt(goToPageInput);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                          setCurrentPage(pageNum);
                        } else {
                          toast({ title: "Halaman Tidak Valid", description: `Masukkan nomor antara 1 dan ${totalPages}.`, variant: "destructive" });
                          setGoToPageInput(String(currentPage));
                        }
                      }
                    }}
                    className="h-9 w-16 text-center"
                    placeholder="Ke Hal"
                    disabled={isLoadingHierarchies}
                  />
                  <Button
                    onClick={() => {
                      const pageNum = parseInt(goToPageInput);
                      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                        setCurrentPage(pageNum);
                      } else {
                        toast({ title: "Halaman Tidak Valid", description: `Masukkan nomor antara 1 dan ${totalPages}.`, variant: "destructive" });
                        setGoToPageInput(String(currentPage));
                      }
                    }}
                    variant="outline"
                    size="sm"
                    disabled={isLoadingHierarchies || !goToPageInput || parseInt(goToPageInput) < 1 || parseInt(goToPageInput) > totalPages}
                  >
                    OK
                  </Button>
                </div>
              </div>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || isLoadingHierarchies}
                variant="outline"
                size="sm"
              >
                Berikutnya
              </Button>
            </div>
          )}
           {filteredCustomers.length === 0 && searchTerm === '' && statusFilter === 'all' && !isLoadingHierarchies && customers.length > 0 && (
             <p className="text-center text-muted-foreground mt-6">Tidak ada pelanggan untuk ditampilkan di halaman ini.</p>
           )}
           {customers.length === 0 && !isLoadingHierarchies && (
             <p className="text-center text-muted-foreground mt-6">Belum ada pelanggan yang terdaftar. Klik "Tambah Pelanggan Baru" untuk memulai.</p>
           )}
        </CardContent>
      </Card>

      <Dialog open={isCustomerFormDialogOpen} onOpenChange={(isOpen) => { setIsCustomerFormDialogOpen(isOpen); if (!isOpen) setIsKtpVisibleInForm(false); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === 'add' ? 'Tambah Pelanggan Baru' : 'Edit Data Pelanggan'}</DialogTitle>
            <DialogDescription>
              {formMode === 'add' ? 'Masukkan detail untuk pelanggan baru beserta layanannya.' : `Perbarui detail dan layanan untuk ${customerFormData.customerName}.`} Bidang dengan tanda * wajib diisi.
            </DialogDescription>
          </DialogHeader>
          {formMode === 'edit' && customerFormData.services.length > 0 && (
            <div className="px-6 pt-4 pb-2 border-b">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Layanan Terdaftar:</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {TOKEN_TYPES_FOR_CUSTOMER_SERVICES.map(typeInfo => {
                  const countServicesOfType = customerFormData.services.filter(
                    s => s.tokenType === typeInfo.id
                  ).length;

                  if (countServicesOfType > 0) {
                    return (
                      <Badge
                        key={typeInfo.id}
                        variant="outline"
                        className={cn(
                          "flex items-center space-x-1 py-0.5 px-2 text-xs",
                          (serviceBgColors[typeInfo.id] || serviceBgColors.DEFAULT).split(' ').find(cls => cls.startsWith('border-')),
                          serviceHeaderColors[typeInfo.id] || serviceHeaderColors.DEFAULT
                        )}
                      >
                        <typeInfo.icon className={cn("h-3.5 w-3.5")} />
                        <span className="font-bold text-sm">{countServicesOfType}</span>
                      </Badge>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
          {isLoadingHierarchies ? (
            <div className="flex items-center justify-center h-32">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Memuat data pendukung...
            </div>
           ) : (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="pl-4">
                  <div className="flex items-center">
                    <div className="flex-grow">
                      <Label htmlFor="form-customerKTP">No. KTP*</Label>
                      <Input
                        id="form-customerKTP"
                        name="customerKTP"
                        value={formMode === 'add' || isKtpVisibleInForm ? customerFormData.customerKTP : maskKtp(customerFormData.customerKTP)}
                        onChange={handleKtpInputChange}
                        placeholder="Contoh: 1234 - 5678 - 9012 - 3456"
                        disabled={(formMode === 'edit' && !isKtpVisibleInForm) || isSubmittingCustomer}
                        className="mt-1 w-full bg-slate-200 dark:bg-zinc-800"
                      />
                    </div>
                    {formMode === 'edit' && (
                       isKtpVisibleInForm ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="ml-2 mt-7"
                            onClick={() => setIsKtpVisibleInForm(false)}
                            disabled={isSubmittingCustomer}
                            title="Sembunyikan No. KTP"
                        >
                            <EyeOff className="mr-1 h-4 w-4" /> Sembunyikan
                        </Button>
                       ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="ml-2 mt-7"
                          onClick={() => {
                            setSupervisionAction({ type: 'viewKtp' });
                            setShowSupervisionPasswordDialog(true);
                          }}
                          disabled={isSubmittingCustomer}
                          title="Lihat No. KTP Lengkap"
                        >
                          <Eye className="mr-1 h-4 w-4" /> Lihat
                        </Button>
                       )
                    )}
                  </div>
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerId">ID Pelanggan</Label>
                  <Input
                    id="form-customerId"
                    name="customerId"
                    value={customerFormData.customerId}
                    readOnly
                    className={cn(
                        "mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800",
                        customerFormData.customerId && customerFormData.customerId.startsWith('PENDING-') && "text-red-600 dark:text-red-500"
                      )}
                    placeholder="Akan digenerate otomatis"
                  />
                   <p className="text-xs text-muted-foreground mt-1">ID Pelanggan akan otomatis PENDING-XXXX jika tanpa layanan, atau SAI-... jika dengan layanan.</p>
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerName">Nama*</Label>
                  <Input
                    id="form-customerName"
                    name="customerName"
                    value={customerFormData.customerName}
                    onChange={handleCoreInputChange}
                    disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    className="mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800"
                  />
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerUsername">Username*</Label>
                  <Input
                    id="form-customerUsername"
                    name="customerUsername"
                    value={customerFormData.customerUsername}
                    onChange={handleCoreInputChange}
                    disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    className="mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800"
                  />
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerPassword">Password{formMode === 'add' ? '*' : ''}</Label>
                  <div className="relative mt-1 w-[70%]">
                    <Input
                      id="form-customerPassword"
                      name="customerPassword"
                      type={showPasswordInForm ? 'text' : 'password'}
                      value={customerFormData.customerPassword || ''}
                      onChange={handleCoreInputChange}
                      className="pr-10 w-full bg-slate-200 dark:bg-zinc-800"
                      placeholder={formMode === 'edit' ? 'Kosongkan jika tidak ingin diubah' : '••••••••'}
                      disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPasswordInForm(!showPasswordInForm)}
                      aria-label={showPasswordInForm ? "Sembunyikan password" : "Tampilkan password"}
                      disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    >
                      {showPasswordInForm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                   {formMode === 'edit' && !customerFormData.customerPassword && (
                     <p className="text-xs text-muted-foreground mt-1">Password saat ini akan tetap digunakan.</p>
                   )}
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerEmail">Email*</Label>
                  <Input
                    id="form-customerEmail"
                    name="customerEmail"
                    type="email"
                    value={customerFormData.customerEmail}
                    onChange={handleCoreInputChange}
                    disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    className="mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800"
                  />
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerPhone">Telepon</Label>
                  <Input
                    id="form-customerPhone"
                    name="customerPhone"
                    value={customerFormData.customerPhone || ''}
                    onChange={handleCoreInputChange}
                    disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    className="mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800"
                  />
                </div>
                <div className="pl-4">
                  <Label htmlFor="form-customerAddress">Alamat</Label>
                  <Input
                    id="form-customerAddress"
                    name="customerAddress"
                    value={customerFormData.customerAddress || ''}
                    onChange={handleCoreInputChange}
                    disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    className="mt-1 w-[70%] bg-slate-200 dark:bg-zinc-800"
                  />
                </div>
                 <div className="pl-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="form-isTransactionActive"
                      checked={customerFormData.isTransactionActive}
                      onCheckedChange={(checked) => setCustomerFormData(prev => ({ ...prev, isTransactionActive: checked }))}
                      disabled={(formMode === 'add' && !isKtpCompleteForAdd) || isSubmittingCustomer}
                    />
                    <Label htmlFor="form-isTransactionActive" className="cursor-pointer">Transaksi Global Aktif</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Jika dinonaktifkan, semua layanan pelanggan ini tidak akan bisa melakukan transaksi.
                  </p>
                </div>


                <hr className="my-6"/>
                <h4 className="text-md font-semibold text-center mb-4">Daftar Layanan Terhubung:</h4>

                <div className="flex flex-wrap justify-center gap-3 p-4 border rounded-lg shadow-sm mb-6 bg-muted/20 dark:bg-muted/10">
                  {TOKEN_TYPES_FOR_CUSTOMER_SERVICES.map(typeInfo => (
                    <Button
                      key={typeInfo.id}
                      type="button"
                      variant="outline"
                      className={cn(
                        "flex flex-col items-center h-auto p-3 space-y-1 w-24 transition-all duration-200",
                        activeServiceDisplayType === typeInfo.id
                          ? (serviceBannerBgColors[typeInfo.id] || serviceBannerBgColors.DEFAULT)
                          : "bg-card hover:bg-accent hover:text-accent-foreground",
                        activeServiceDisplayType === typeInfo.id && "border-2 border-primary shadow-lg scale-105",
                        activeServiceDisplayType === typeInfo.id && (serviceHeaderColors[typeInfo.id] || serviceHeaderColors.DEFAULT)
                      )}
                      onClick={() => {
                        setActiveServiceDisplayType(prev => prev === typeInfo.id ? null : typeInfo.id);
                      }}
                      disabled={isSubmittingCustomer || (formMode === 'add' && !isKtpCompleteForAdd)}
                    >
                       <typeInfo.icon className={cn(
                          "h-7 w-7",
                          (serviceHeaderColors[typeInfo.id] || serviceHeaderColors.DEFAULT)
                      )} />
                      <span className={cn(
                          "text-xs text-center",
                          (serviceHeaderColors[typeInfo.id] || serviceHeaderColors.DEFAULT),
                           activeServiceDisplayType === typeInfo.id && "font-semibold"
                      )}>{typeInfo.label}</span>
                    </Button>
                  ))}
                </div>

                {activeServiceDisplayType && (() => {
                  const typeConfig = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === activeServiceDisplayType);
                  if (!typeConfig) return null;

                  const servicesOfType = customerFormData.services.filter(s => s.tokenType === activeServiceDisplayType);
                  const allServicesOfThisTypeAreUISaved = servicesOfType.length > 0 && servicesOfType.every(s => s.isUISaved === true);
                  
                  const currentActiveTabId = activeServiceInstanceTabs[activeServiceDisplayType] || 
                                           (servicesOfType.length > 0 ? (servicesOfType[0].tempId || servicesOfType[0].serviceId!) : '');


                  return (
                    <div className="mb-6">
                      <h5 className={cn(
                          "text-lg font-semibold mb-3 text-center flex items-center justify-center",
                          serviceHeaderColors[typeConfig.id] || serviceHeaderColors.DEFAULT
                        )}
                      >
                        <typeConfig.icon className={cn("mr-2 h-5 w-5", serviceHeaderColors[typeConfig.id] || serviceHeaderColors.DEFAULT)} />
                        Layanan {typeConfig.label}
                      </h5>
                      {servicesOfType.length > 0 ? (
                        <Tabs
                            value={currentActiveTabId}
                            onValueChange={(value) => setActiveServiceInstanceTabs(prev => ({ ...prev, [activeServiceDisplayType]: value }))}
                            className="w-full"
                        >
                            <ScrollArea className="w-full whitespace-nowrap rounded-md border-b bg-muted/20 dark:bg-muted/10">
                                <div className="whitespace-nowrap pb-2.5"> 
                                    <TabsList className="relative inline-flex h-auto p-1 space-x-1 bg-transparent rounded-none">
                                        {servicesOfType.map((serviceInstance, indexWithinType) => {
                                            const tabValue = serviceInstance.tempId || serviceInstance.serviceId!;
                                            const isVerified = serviceInstance.isUISaved;
                                            return (
                                                <TabsTrigger 
                                                    key={tabValue} 
                                                    value={tabValue} 
                                                    className={cn(
                                                        "flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-sm transition-all",
                                                        "bg-[hsl(var(--teal-green-bg))] text-[hsl(var(--teal-green-fg))] hover:bg-[hsl(var(--teal-green-hover-bg))]",
                                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                        "disabled:pointer-events-none disabled:opacity-50",
                                                        "data-[state=active]:bg-[hsl(var(--teal-green-active-bg))] data-[state=active]:text-[hsl(var(--teal-green-fg))] data-[state=active]:shadow-inner data-[state=active]:ring-2 data-[state=active]:ring-[hsl(var(--teal-green-active-border))]",
                                                        "dark:bg-[hsl(var(--dark-teal-green-bg))] dark:text-[hsl(var(--dark-teal-green-fg))] dark:hover:bg-[hsl(var(--dark-teal-green-hover-bg))]",
                                                        "dark:data-[state=active]:bg-[hsl(var(--dark-teal-green-active-bg))] dark:data-[state=active]:text-[hsl(var(--dark-teal-green-fg))] dark:data-[state=active]:ring-[hsl(var(--dark-teal-green-active-border))]"
                                                    )}
                                                >
                                                    {typeConfig.label} #{indexWithinType + 1}
                                                    {isVerified && <CheckCircle2 className="ml-2 h-3 w-3 text-green-100 dark:text-green-300" />}
                                                    {isVerified && <span className="ml-1 text-xs text-green-100 dark:text-green-300">(Verified)</span>}
                                                </TabsTrigger>
                                            );
                                        })}
                                    </TabsList>
                                </div>
                                <ScrollBar orientation="horizontal" className="h-2.5" />
                            </ScrollArea>
                            {servicesOfType.map((serviceInstance, indexWithinType) => {
                                const overallServiceIndex = customerFormData.services.findIndex(
                                s => (s.tempId && s.tempId === serviceInstance.tempId) || (s.serviceId && s.serviceId === serviceInstance.serviceId && !s.tempId && !serviceInstance.tempId && s.tokenType === serviceInstance.tokenType)
                                );
                                if (overallServiceIndex === -1) return null;
                                const tabValue = serviceInstance.tempId || serviceInstance.serviceId!;
                                const isVerified = serviceInstance.isUISaved;

                                const currentBgColor = serviceInstance.tokenType ? serviceBgColors[serviceInstance.tokenType as string] : serviceBgColors.DEFAULT;
                                const availableAreasForService = serviceInstance.tokenType ? getAvailableAreas(serviceInstance.tokenType as string) : [];
                                const availableProjectsForService = serviceInstance.tokenType && serviceInstance.areaProject ? getAvailableProjects(serviceInstance.tokenType as string, serviceInstance.areaProject) : [];
                                const availableVendorsForService = serviceInstance.tokenType && serviceInstance.areaProject && serviceInstance.project ? getAvailableVendors(serviceInstance.tokenType as string, serviceInstance.areaProject, serviceInstance.project) : [];
                                
                                const powerVolumeLabel = (serviceInstance.tokenType === 'ELECTRICITY' || serviceInstance.tokenType === 'SOLAR') ? 'Daya*' :
                                                         (serviceInstance.tokenType === 'WATER' || serviceInstance.tokenType === 'GAS') ? 'Volume*' :
                                                         'Daya/Volume*';
                                const powerVolumePlaceholder = (serviceInstance.tokenType === 'ELECTRICITY' || serviceInstance.tokenType === 'SOLAR') ? 'mis: 1300, 2200 (angka saja)' :
                                                               (serviceInstance.tokenType === 'WATER' || serviceInstance.tokenType === 'GAS') ? 'mis: 100, 50 (angka saja)' :
                                                               'mis: 1300 / 100 (angka saja)';


                                return (
                                <TabsContent 
                                    key={tabValue} 
                                    value={tabValue} 
                                    className={cn(
                                        "mt-1",
                                        isVerified && "border-[3px] border-green-500 dark:border-green-400 rounded-md"
                                      )}
                                >
                                    <div className={cn("space-y-3 p-4 rounded-md", currentBgColor)}>
                                        <h4 className={cn("text-sm font-semibold mb-1", serviceHeaderColors[typeConfig.id] || serviceHeaderColors.DEFAULT)}>Konfigurasi {typeConfig.label} #{indexWithinType + 1}</h4>
                                        <div>
                                            <Label htmlFor={`service-id-${overallServiceIndex}`} className="text-xs">ID Layanan/No. Meter*</Label>
                                            <Input
                                                id={`service-id-${overallServiceIndex}`}
                                                value={serviceInstance.serviceId || ''}
                                                onChange={(e) => handleServiceInstanceChange(overallServiceIndex, 'serviceId', e.target.value)}
                                                placeholder="Mis: 112233445566 (PLN), PDAM001"
                                                className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800"
                                                disabled={isSubmittingCustomer}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor={`service-power-volume-${overallServiceIndex}`} className="text-xs">{powerVolumeLabel}</Label>
                                            <Input
                                                id={`service-power-volume-${overallServiceIndex}`}
                                                type="text"
                                                inputMode="numeric"
                                                value={serviceInstance.powerOrVolume || ''}
                                                onChange={(e) => {
                                                    const numericValue = e.target.value.replace(/\D/g, '');
                                                    handleServiceInstanceChange(overallServiceIndex, 'powerOrVolume', numericValue);
                                                }}
                                                placeholder={powerVolumePlaceholder}
                                                className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800"
                                                disabled={isSubmittingCustomer}
                                            />
                                        </div>
                                        <div>
                                        <Label htmlFor={`service-area-${overallServiceIndex}`} className="text-xs">Area Project*</Label>
                                        <Select
                                            value={serviceInstance.areaProject || ''}
                                            onValueChange={(value) => handleServiceInstanceChange(overallServiceIndex, 'areaProject', value)}
                                            disabled={isSubmittingCustomer || !serviceInstance.tokenType}
                                        >
                                            <SelectTrigger id={`service-area-${overallServiceIndex}`} className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800">
                                            <SelectValue placeholder={!serviceInstance.tokenType ? "Jenis layanan tidak valid" : (availableAreasForService.length === 0 ? "Tidak ada Area" : "Pilih Area Project")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                            {Array.isArray(availableAreasForService) && availableAreasForService.map(area => (
                                                <SelectItem key={area.name} value={area.name}>{area.name}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        </div>
                                        <div>
                                        <Label htmlFor={`service-project-${overallServiceIndex}`} className="text-xs">Project*</Label>
                                        <Select
                                            value={serviceInstance.project || ''}
                                            onValueChange={(value) => handleServiceInstanceChange(overallServiceIndex, 'project', value)}
                                            disabled={isSubmittingCustomer || !serviceInstance.areaProject}
                                        >
                                            <SelectTrigger id={`service-project-${overallServiceIndex}`} className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800">
                                            <SelectValue placeholder={!serviceInstance.areaProject ? "Pilih Area dulu" : (availableProjectsForService.length === 0 ? "Tidak ada Project" : "Pilih Project")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                            {Array.isArray(availableProjectsForService) && availableProjectsForService.map(proj => (
                                                <SelectItem key={proj.name} value={proj.name}>{proj.name}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                        </div>
                                        <div>
                                        <Label htmlFor={`service-vendor-${overallServiceIndex}`} className="text-xs">Vendor*</Label>
                                        <Select
                                            value={serviceInstance.vendorName || ''}
                                            onValueChange={(value) => handleServiceInstanceChange(overallServiceIndex, 'vendorName', value)}
                                            disabled={isSubmittingCustomer || !serviceInstance.project}
                                        >
                                            <SelectTrigger id={`service-vendor-${overallServiceIndex}`} className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800">
                                            <SelectValue placeholder={!serviceInstance.project ? "Pilih Project dulu" : (Array.isArray(availableVendorsForService) && availableVendorsForService.length === 0 ? "Tidak ada Vendor" : "Pilih Vendor")} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Array.isArray(availableVendorsForService) && availableVendorsForService.map(vend => (
                                                <SelectItem key={vend.name} value={vend.name}>{vend.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        </div>
                                        <div>
                                            <Label htmlFor={`service-notes-${overallServiceIndex}`} className="text-xs">Catatan Layanan (Opsional)</Label>
                                            <Input
                                                id={`service-notes-${overallServiceIndex}`}
                                                value={serviceInstance.serviceSpecificNotes || ''}
                                                onChange={(e) => handleServiceInstanceChange(overallServiceIndex, 'serviceSpecificNotes', e.target.value)}
                                                className="h-9 text-sm mt-1 bg-slate-200 dark:bg-zinc-800"
                                                placeholder="Catatan spesifik untuk layanan ini"
                                                disabled={isSubmittingCustomer}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                id={`service-isTransactionActive-${overallServiceIndex}`}
                                                checked={serviceInstance.isServiceTransactionActive === undefined ? true : serviceInstance.isServiceTransactionActive}
                                                onCheckedChange={(checked) => handleServiceInstanceSwitchChange(overallServiceIndex, 'isServiceTransactionActive', checked)}
                                                disabled={isSubmittingCustomer || !customerFormData.isTransactionActive}
                                                />
                                                <Label htmlFor={`service-isTransactionActive-${overallServiceIndex}`} className="cursor-pointer text-xs">Transaksi Layanan Ini Aktif</Label>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="sm"
                                                className="whitespace-nowrap px-2.5 py-1 h-auto text-xs"
                                                onClick={() => {
                                                    setServiceInstanceToDelete({
                                                        tempId: serviceInstance.tempId,
                                                        serviceId: serviceInstance.serviceId,
                                                        typeLabel: typeConfig.label,
                                                        instanceNumber: indexWithinType + 1,
                                                        tokenType: serviceInstance.tokenType
                                                    });
                                                }}
                                                disabled={isSubmittingCustomer}
                                            >
                                                <Trash2 className="mr-1 h-3 w-3" /> Hapus Instance Ini
                                            </Button>
                                        </div>
                                        {!customerFormData.isTransactionActive && (
                                            <p className="text-xs text-muted-foreground mt-1">Transaksi global pelanggan dinonaktifkan.</p>
                                        )}
                                    </div>
                                </TabsContent>
                                );
                            })}
                        </Tabs>
                      ) : (
                         <p className="text-xs text-center text-muted-foreground mt-2">Belum ada layanan {typeConfig.label} ditambahkan.</p>
                      )}
                      <div className="mt-6 flex justify-center space-x-3">
                          <Button
                              type="button"
                              variant="default"
                              onClick={() => handleSaveServiceTypeConfiguration(activeServiceDisplayType)}
                              disabled={isSubmittingCustomer || (formMode === 'add' && !isKtpCompleteForAdd) || servicesOfType.length === 0 || allServicesOfThisTypeAreUISaved}
                          >
                              <Save className="mr-2 h-4 w-4" /> Simpan Semua Layanan {typeConfig.label}
                          </Button>
                          <Button
                              type="button"
                              variant="outline"
                              onClick={() => addServiceInstanceByType(activeServiceDisplayType)}
                              disabled={isSubmittingCustomer || (formMode === 'add' && !isKtpCompleteForAdd)}
                          >
                              <PlusCircle className="mr-2 h-4 w-4" /> Tambah Layanan {typeConfig.label} Baru
                          </Button>
                      </div>
                    </div>
                  );
                })()}

                {customerFormData.services.length === 0 && !activeServiceDisplayType && (
                    <p className="text-xs text-center text-muted-foreground mt-2">Pilih jenis layanan di atas untuk mulai menambahkan.</p>
                )}
                 {!activeServiceDisplayType && customerFormData.services.length > 0 && (
                    <p className="text-xs text-center text-muted-foreground mt-2">Pilih jenis layanan di atas untuk melihat atau menambah layanan.</p>
                )}
              </div>
            </ScrollArea>
           )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmittingCustomer} onClick={() => { setIsCustomerFormDialogOpen(false); setIsKtpVisibleInForm(false); }}>Batal</Button>
            </DialogClose>
            <Button onClick={handleSaveCustomer} disabled={isSubmittingCustomer || !isFormReadyForSubmission || isLoadingHierarchies}>
              {isSubmittingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {formMode === 'add' ? 'Simpan Pelanggan' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailCustomerDialogOpen} onOpenChange={setIsDetailCustomerDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Pelanggan: {selectedCustomerForDetail?.customerName}</DialogTitle>
            <DialogDescription>Informasi lengkap mengenai pelanggan dan layanannya.</DialogDescription>
          </DialogHeader>
          {selectedCustomerForDetail && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-3 py-4 text-sm">
                <div className="grid grid-cols-3 items-center gap-x-2"><span className="text-xs text-muted-foreground text-right">No. KTP:</span> <p className="font-medium col-span-2">{maskKtp(selectedCustomerForDetail.customerKTP)}</p></div>
                <div className="grid grid-cols-3 items-center gap-x-2">
                  <span className="text-xs text-muted-foreground text-right">ID Pelanggan:</span> 
                  <p className={cn(
                      "font-medium col-span-2",
                      selectedCustomerForDetail.customerId && selectedCustomerForDetail.customerId.startsWith('PENDING-') && "text-red-600 dark:text-red-500"
                    )}
                  >
                    {selectedCustomerForDetail.customerId || 'Kosong'}
                  </p>
                </div>
                <div className="grid grid-cols-3 items-center gap-x-2"><span className="text-xs text-muted-foreground text-right">Nama:</span> <p className="col-span-2">{selectedCustomerForDetail.customerName}</p></div>
                <div className="grid grid-cols-3 items-center gap-x-2"><span className="text-xs text-muted-foreground text-right">Username:</span> <p className="col-span-2">{selectedCustomerForDetail.customerUsername || '-'}</p></div>

                <div>
                  <div className="grid grid-cols-3 items-center gap-x-2">
                    <Label className="text-xs text-muted-foreground text-right">Password:</Label>
                    <div className="flex items-center col-span-2">
                        <p className="font-mono flex-grow">
                        {showDetailPassword && selectedCustomerForDetail.customerPassword ? selectedCustomerForDetail.customerPassword : '••••••••'}
                        </p>
                        <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setShowDetailPassword(!showDetailPassword)}
                        aria-label={showDetailPassword ? "Sembunyikan password" : "Tampilkan password"}
                        >
                        {showDetailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 items-center gap-x-2"><span className="text-xs text-muted-foreground text-right">Email:</span> <p className="col-span-2">{selectedCustomerForDetail.customerEmail}</p></div>
                <div className="grid grid-cols-3 items-center gap-x-2">
                    <span className="text-xs text-muted-foreground text-right">Telepon:</span>
                    <div className="col-span-2 flex items-center gap-2">
                        <span>{selectedCustomerForDetail.customerPhone || '-'}</span>
                        {selectedCustomerForDetail.customerPhone && formatPhoneNumberForWhatsApp(selectedCustomerForDetail.customerPhone) && (
                        <a
                            href={`https://wa.me/${formatPhoneNumberForWhatsApp(selectedCustomerForDetail.customerPhone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Chat dengan ${selectedCustomerForDetail.customerName} di WhatsApp`}
                            className={cn(
                                buttonVariants({ variant: "outline", size: "icon" }),
                                "h-6 w-6 border-green-500 text-green-600 hover:bg-green-50 dark:border-green-400 dark:text-green-400 dark:hover:bg-green-900/50"
                            )}
                            >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.33 3.42 16.79L2.05 22L7.31 20.63C8.72 21.39 10.33 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.27 20.83 6.82 18.91 4.91C17 3.01 14.61 2 12.04 2M12.04 3.88C16.52 3.88 20.07 7.42 20.07 11.91C20.07 16.4 16.52 19.94 12.04 19.94C10.53 19.94 9.11 19.56 7.91 18.89L7.52 18.67L4.56 19.55L5.45 16.68L5.22 16.29C4.47 14.98 4.01 13.48 4.01 11.91C4.01 7.42 7.56 3.88 12.04 3.88M17.44 14.84C17.33 14.73 16.52 14.32 16.34 14.25C16.16 14.18 16.03 14.14 15.91 14.32C15.78 14.5 15.31 15.03 15.17 15.17C15.03 15.31 14.89 15.33 14.64 15.23C14.39 15.12 13.49 14.81 12.43 13.89C11.61 13.19 11.03 12.32 10.89 12.07C10.75 11.82 10.85 11.71 10.97 11.59C11.08 11.49 11.23 11.31 11.35 11.17C11.47 11.03 11.53 10.91 11.63 10.73C11.73 10.55 11.67 10.41 11.61 10.29C11.55 10.18 11.02 8.86 10.79 8.31C10.56 7.76 10.33 7.82 10.17 7.81C10.01 7.81 9.86 7.81 9.71 7.81C9.56 7.81 9.32 7.87 9.12 8.24C8.92 8.61 8.24 9.29 8.24 10.55C8.24 11.81 9.14 13.02 9.26 13.17C9.38 13.31 10.95 15.64 13.29 16.59C13.85 16.83 14.29 16.97 14.61 17.07C15.14 17.23 15.64 17.19 16.03 17.12C16.47 17.04 17.26 16.57 17.42 16.13C17.58 15.68 17.58 15.31 17.52 15.17C17.47 15.04 17.55 14.95 17.44 14.84Z"></path>
                            </svg>
                            <span className="sr-only">Chat WhatsApp</span>
                        </a>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-3 items-start gap-x-2"><span className="text-xs text-muted-foreground text-right">Alamat:</span> <p className="col-span-2">{selectedCustomerForDetail.customerAddress || '-'}</p></div>
                <div className="grid grid-cols-3 items-center gap-x-2">
                    <span className="text-xs text-muted-foreground text-right">Tgl. Registrasi:</span>
                     <p className="col-span-2">
                        {selectedCustomerForDetail.customerRegistrationDate.toLocaleDateString('id-ID', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        })}
                    </p>
                </div>
                 <div className="grid grid-cols-3 items-center gap-x-2">
                  <span className="text-xs text-muted-foreground text-right">Transaksi Global:</span>
                  <p className={cn("col-span-2 font-medium", (selectedCustomerForDetail.isTransactionActive === undefined ? true : selectedCustomerForDetail.isTransactionActive) ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500")}>
                    {(selectedCustomerForDetail.isTransactionActive === undefined ? true : selectedCustomerForDetail.isTransactionActive) ? 'Aktif' : 'Nonaktif'}
                  </p>
                </div>
                
                {selectedCustomerForDetail && selectedCustomerForDetail.services && selectedCustomerForDetail.services.length > 0 && (() => {
                  const nonActiveServicesByType: Record<string, number> = {};
                  TOKEN_TYPES_FOR_CUSTOMER_SERVICES.forEach(t => nonActiveServicesByType[t.id] = 0);
                  let totalNonActiveIndividualServices = 0;

                  selectedCustomerForDetail.services.forEach(service => {
                    if (service.isServiceTransactionActive === false) {
                      if (service.tokenType && nonActiveServicesByType.hasOwnProperty(service.tokenType)) {
                        nonActiveServicesByType[service.tokenType]++;
                        totalNonActiveIndividualServices++;
                      }
                    }
                  });

                  if (totalNonActiveIndividualServices > 0 && (selectedCustomerForDetail.isTransactionActive === undefined ? true : selectedCustomerForDetail.isTransactionActive)) {
                    const nonActiveDescriptions: string[] = [];
                    TOKEN_TYPES_FOR_CUSTOMER_SERVICES.forEach(typeInfo => {
                      if (nonActiveServicesByType[typeInfo.id] > 0) {
                        nonActiveDescriptions.push(`${nonActiveServicesByType[typeInfo.id]} ${typeInfo.label}`);
                      }
                    });
                    return (
                      <div className="grid grid-cols-3 items-start gap-x-2 mt-1">
                        <span className="text-xs text-red-600 dark:text-red-500 text-right pt-px">Transaksi Nonaktif:</span>
                        <p className="col-span-2 text-red-600 dark:text-red-500 font-medium">
                          {nonActiveDescriptions.join(', ')}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}


                <hr className="my-3" />
                <h4 className="text-md font-semibold mb-1">Daftar Layanan:</h4>
                {selectedCustomerForDetail.services && selectedCustomerForDetail.services.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {selectedCustomerForDetail.services.map((service, index) => {
                      const serviceTypeInfo = TOKEN_TYPES_FOR_CUSTOMER_SERVICES.find(t => t.id === service.tokenType);
                      const bgColor = service.tokenType && serviceBgColors[service.tokenType as string] ? serviceBgColors[service.tokenType as string] : serviceBgColors.DEFAULT;
                      const headerColor = service.tokenType && serviceHeaderColors[service.tokenType as string] ? serviceHeaderColors[service.tokenType as string] : serviceHeaderColors.DEFAULT;
                      const isServiceCurrentlyActive = service.isServiceTransactionActive === undefined ? true : service.isServiceTransactionActive;
                      const isGloballyActive = selectedCustomerForDetail.isTransactionActive === undefined ? true : selectedCustomerForDetail.isTransactionActive;
                      
                      const powerVolumeLabel = (service.tokenType === 'ELECTRICITY' || service.tokenType === 'SOLAR') ? 'Daya:' :
                                                 (service.tokenType === 'WATER' || service.tokenType === 'GAS') ? 'Volume:' :
                                                 'Daya/Volume:';

                      return (
                        <AccordionItem
                          value={service.serviceId || `service-${index}`}
                          key={service.serviceId || index}
                          className={cn("mb-2 rounded-lg border overflow-hidden", bgColor.split(' ')[0])}
                        >
                          <AccordionTrigger className={cn("px-4 py-3 hover:no-underline", headerColor)}>
                            <div className="flex items-center">
                              {serviceTypeInfo?.icon && <serviceTypeInfo.icon className={cn("mr-2 h-5 w-5", headerColor)}/>}
                              <span className="font-medium">{serviceTypeInfo?.label || service.tokenType}</span>
                              <span className="ml-2 text-xs text-muted-foreground">(ID: {service.serviceId})</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className={cn("px-4 pb-4 pt-2 text-sm space-y-2", bgColor)}>
                              <div className="grid grid-cols-3 items-center gap-x-2"><span className="font-medium text-xs text-right">{powerVolumeLabel}</span> <span className="col-span-2">{service.powerOrVolume || '-'}</span></div>
                              <div className="grid grid-cols-3 items-center gap-x-2"><span className="font-medium text-xs text-right">Area:</span> <span className="col-span-2">{service.areaProject}</span></div>
                              <div className="grid grid-cols-3 items-center gap-x-2"><span className="font-medium text-xs text-right">Project:</span> <span className="col-span-2">{service.project}</span></div>
                              <div className="grid grid-cols-3 items-center gap-x-2"><span className="font-medium text-xs text-right">Vendor:</span> <span className="col-span-2">{service.vendorName}</span></div>
                              {service.serviceSpecificNotes && <div className="grid grid-cols-3 items-start gap-x-2 mt-1"><span className="font-medium text-xs text-right pt-px">Catatan:</span> <span className="col-span-2">{service.serviceSpecificNotes}</span></div>}
                              
                              <div className="grid grid-cols-3 items-center gap-x-2 pt-2 border-t mt-2">
                                <span className="font-medium text-xs text-right">Transaksi Layanan:</span>
                                <div className="col-span-2 flex items-center gap-2">
                                    <span className={cn(isServiceCurrentlyActive && isGloballyActive ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500")}>
                                        {isGloballyActive ? (isServiceCurrentlyActive ? 'Aktif' : 'Nonaktif') : 'Nonaktif (Global)'}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant={isServiceCurrentlyActive ? "outline" : "default"}
                                        className={cn(
                                            "h-7 px-2 py-1 text-xs",
                                            isServiceCurrentlyActive 
                                                ? "border-orange-500 text-orange-600 hover:bg-orange-100 dark:border-orange-400 dark:text-orange-400" 
                                                : "bg-green-500 hover:bg-green-600 text-white"
                                        )}
                                        onClick={() => selectedCustomerForDetail && handleToggleSpecificServiceTransactionStatus(selectedCustomerForDetail, service.serviceId)}
                                        disabled={isSubmittingCustomer || !isGloballyActive}
                                        title={!isGloballyActive ? "Transaksi global dinonaktifkan untuk pelanggan ini" : (isServiceCurrentlyActive ? "Nonaktifkan transaksi untuk layanan ini" : "Aktifkan transaksi untuk layanan ini")}
                                    >
                                        {isServiceCurrentlyActive ? <Ban className="mr-1 h-3 w-3" /> : <CircleCheck className="mr-1 h-3 w-3" />}
                                        {isServiceCurrentlyActive ? 'Nonaktifkan' : 'Aktifkan'}
                                    </Button>
                                </div>
                              </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                ) : (
                  <p className="text-muted-foreground">Pelanggan ini belum memiliki layanan terdaftar.</p>
                )}
                 <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => {
                    setIsDetailCustomerDialogOpen(false);
                    if(selectedCustomerForDetail) handleOpenEditDialog(selectedCustomerForDetail);
                  }}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" /> Edit Layanan & Data Pelanggan
                </Button>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {customerToDelete && (
        <AlertDialog open={!!customerToDelete} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus pelanggan dengan ID &quot;{customerToDelete.customerId || 'Tanpa ID'}&quot; - Nama: &quot;{customerToDelete.customerName}&quot; secara permanen beserta semua data layanannya.
                Data yang dihapus tidak dapat dikembalikan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCustomerToDelete(null)} disabled={isSubmittingCustomer}>
                Batal
              </AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteCustomer} className="bg-destructive hover:bg-destructive/90" disabled={isSubmittingCustomer}>
                {isSubmittingCustomer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {serviceInstanceToDelete && (
        <AlertDialog
            open={!!serviceInstanceToDelete}
            onOpenChange={(open) => {
                if (!open) setServiceInstanceToDelete(null);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Konfirmasi Hapus Layanan</AlertDialogTitle>
                    <AlertDialogDescription>
                        Anda yakin ingin menghapus layanan {serviceInstanceToDelete.typeLabel} #{serviceInstanceToDelete.instanceNumber} (ID: {serviceInstanceToDelete.serviceId || serviceInstanceToDelete.tempId || 'Baru'}) dari daftar layanan pelanggan ini?
                        <br />
                        Perubahan ini baru akan permanen setelah Anda menyimpan data pelanggan.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setServiceInstanceToDelete(null)}>
                        Batal
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={confirmRemoveServiceInstance} className="bg-destructive hover:bg-destructive/90">
                        Ya, Hapus Layanan
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      <Dialog open={showSupervisionPasswordDialog} onOpenChange={(isOpen) => { if(!isOpen) { setSupervisionAction(null); setSupervisionPasswordInput('');} setShowSupervisionPasswordDialog(isOpen);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ShieldAlert className="h-6 w-6 mr-2 text-orange-500" />
              Memerlukan Password Supervisi
            </DialogTitle>
            <DialogDescription>
                {supervisionAction?.type === 'viewKtp' && "Untuk melihat No. KTP lengkap, masukkan password supervisi Anda."}
                {supervisionAction?.type === 'deleteHierarchy' && (
                    <>
                    Untuk melanjutkan penghapusan hierarki, masukkan password supervisi Anda. Ini adalah tindakan ireversibel.
                    <br />
                    <span className="text-xs text-muted-foreground">(Password demo saat ini: {PLACEHOLDER_SUPERVISION_PASSWORD})</span>
                    </>
                )}
                {!supervisionAction && "Aksi ini memerlukan password supervisi."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supervision-password">Password Supervisi</Label>
              <Input 
                id="supervision-password" 
                type="password" 
                value={supervisionPasswordInput}
                onChange={(e) => setSupervisionPasswordInput(e.target.value)}
                placeholder="Masukkan password supervisi" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSupervisionPasswordDialog(false); setSupervisionAction(null); setSupervisionPasswordInput(''); }} disabled={isVerifyingPassword}>
              Batal
            </Button>
            <Button onClick={handleSupervisionPasswordConfirm} disabled={isVerifyingPassword || !supervisionPasswordInput}>
              {isVerifyingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


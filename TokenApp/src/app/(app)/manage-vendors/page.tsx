
'use client';

import { useAuth } from '@/hooks/use-auth';
import { UserRole, type VendorData, type AllTokenSettings } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Trash2, Store, Search, Loader2, Zap, Droplet, Flame, Sun, Info, KeyRound, Eye, EyeOff, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { db, auth } from '@/config/firebase';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, Timestamp, query, orderBy, getDoc as getFirestoreDoc, setDoc, where } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const TOKEN_TYPE_NAMES = [
  { name: 'ELECTRICITY', icon: Zap, label: 'Listrik' },
  { name: 'WATER', icon: Droplet, label: 'Air' },
  { name: 'GAS', icon: Flame, label: 'Gas' },
  { name: 'SOLAR', icon: Sun, label: 'Solar' },
];

const serviceIconColors: Record<string, string> = {
  ELECTRICITY: 'text-yellow-600 dark:text-yellow-400',
  WATER: 'text-blue-600 dark:text-blue-400',
  GAS: 'text-red-600 dark:text-red-400',
  SOLAR: 'text-orange-600 dark:text-orange-400',
  DEFAULT: 'text-muted-foreground',
};

const PLACEHOLDER_SUPERVISION_PASSWORD = "admin123";

export default function ManageVendorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [tokenTypeFilter, setTokenTypeFilter] = useState<string>('all');
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [allTokenSettings, setAllTokenSettings] = useState<AllTokenSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false); // For Add/Edit form
  const [isProcessingDelete, setIsProcessingDelete] = useState(false); // For delete operation

  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedVendorForDetail, setSelectedVendorForDetail] = useState<VendorData | null>(null);

  const [currentVendor, setCurrentVendor] = useState<VendorData | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  
  const [vendorEmailLogin, setVendorEmailLogin] = useState('');
  const [vendorPassword, setVendorPassword] = useState('');
  const [vendorConfirmPassword, setVendorConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [vendorToDelete, setVendorToDelete] = useState<VendorData | null>(null);
  const [showSupervisionPasswordDialog, setShowSupervisionPasswordDialog] = useState(false);
  const [supervisionPasswordInput, setSupervisionPasswordInput] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [supervisionAction, setSupervisionAction] = useState<{ type: 'deleteVendor'; payload: VendorData } | null>(null);


  const [currentPage, setCurrentPage] = useState(1);
  const vendorsPerPage = 10;
  const [goToPageInput, setGoToPageInput] = useState<string>('');

  const vendorsCollectionRef = useMemo(() => collection(db, 'vendors'), []);

  useEffect(() => {
    const fetchVendorsAndSettings = async () => {
      setIsLoading(true);
      try {
        const vendorsQuery = query(vendorsCollectionRef, orderBy('name', 'asc'));
        const vendorsDataPromise = getDocs(vendorsQuery);

        const settingsPromises = TOKEN_TYPE_NAMES.map(tokenType =>
          getFirestoreDoc(doc(db, 'appConfiguration', `settings_${tokenType.name}`))
        );
        const settingsDocsPromise = Promise.all(settingsPromises);

        const [vendorsSnapshot, settingsDocs] = await Promise.all([vendorsDataPromise, settingsDocsPromise]);

        const fetchedVendors = vendorsSnapshot.docs.map((docSnapshot) => {
          const vendorData = docSnapshot.data();
          return {
            ...vendorData,
            id: docSnapshot.id,
            registrationDate: (vendorData.registrationDate as Timestamp)?.toDate ? (vendorData.registrationDate as Timestamp).toDate() : new Date(),
            handledServices: vendorData.handledServices || [],
            emailLogin: vendorData.emailLogin || '',
            authUid: vendorData.authUid || '',
          } as VendorData;
        });
        
        setVendors(fetchedVendors);


        const newAllTokenSettings: AllTokenSettings = {};
        settingsDocs.forEach((settingsDoc, index) => {
          const currentTokenTypeName = TOKEN_TYPE_NAMES[index].name;
          if (settingsDoc.exists()) {
            const docData = settingsDoc.data();
            if (docData && docData.settings && docData.settings[currentTokenTypeName]) {
              newAllTokenSettings[currentTokenTypeName] = docData.settings[currentTokenTypeName];
            } else {
              newAllTokenSettings[currentTokenTypeName] = {};
            }
          } else {
            newAllTokenSettings[currentTokenTypeName] = {};
          }
        });
        setAllTokenSettings(newAllTokenSettings);

      } catch (error) {
        console.error("Error fetching data for vendors page:", error);
        toast({ title: "Error", description: "Gagal mengambil data vendor atau pengaturan token.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchVendorsAndSettings();
    } else {
      setIsLoading(false); 
    }
  }, [toast, user, vendorsCollectionRef]);

  const filteredVendors = useMemo(() => {
    let tempVendors = [...vendors];

    if (tokenTypeFilter && tokenTypeFilter !== "all") {
      tempVendors = tempVendors.filter(vendor =>
        Array.isArray(vendor.handledServices) && vendor.handledServices.includes(tokenTypeFilter)
      );
    }

    if (searchTerm) {
      tempVendors = tempVendors.filter(vendor =>
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (vendor.contactPerson && vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (vendor.email && vendor.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (vendor.emailLogin && vendor.emailLogin.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return tempVendors;
  }, [vendors, searchTerm, tokenTypeFilter]);

  useEffect(() => {
    setCurrentPage(1);
    setGoToPageInput('1');
  }, [searchTerm, tokenTypeFilter, vendorsPerPage]);
  
  useEffect(() => {
    setGoToPageInput(String(currentPage));
  }, [currentPage]);

  const indexOfLastVendor = currentPage * vendorsPerPage;
  const indexOfFirstVendor = indexOfLastVendor - vendorsPerPage;
  const currentVendors = useMemo(() => {
    return filteredVendors.slice(indexOfFirstVendor, indexOfLastVendor);
  },[filteredVendors, indexOfFirstVendor, indexOfLastVendor]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredVendors.length / vendorsPerPage);
  }, [filteredVendors.length, vendorsPerPage]);


  const generateVendorUsageDescription = (vendorNameToDescribe: string, settings: AllTokenSettings): string => {
    const associations: string[] = [];
    TOKEN_TYPE_NAMES.forEach(tokenTypeObj => {
      const tokenTypeName = tokenTypeObj.name;
      if (Object.prototype.hasOwnProperty.call(settings, tokenTypeName) && settings[tokenTypeName]) {
        const areas = settings[tokenTypeName];
        for (const areaName in areas) {
          if (Object.prototype.hasOwnProperty.call(areas, areaName)) {
            const projects = areas[areaName];
            for (const projectName in projects) {
              if (Object.prototype.hasOwnProperty.call(projects, projectName)) {
                const vendorsInProject = projects[projectName];
                if (Object.prototype.hasOwnProperty.call(vendorsInProject, vendorNameToDescribe)) {
                  associations.push(`${tokenTypeObj.label}: ${areaName} > ${projectName}`);
                }
              }
            }
          }
        }
      }
    });
    return associations.join('; ') || 'Belum terhubung ke pengaturan token.';
  };


  const openAddDialog = () => {
    setCurrentVendor(null);
    setVendorName('');
    setContactPerson('');
    setVendorEmail('');
    setVendorPhone('');
    setVendorAddress('');
    setSelectedServices([]);
    setVendorEmailLogin('');
    setVendorPassword('');
    setVendorConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddEditDialogOpen(true);
  };

  const openEditDialog = (vendor: VendorData) => {
    setCurrentVendor(vendor);
    setVendorName(vendor.name);
    setContactPerson(vendor.contactPerson);
    setVendorEmail(vendor.email || '');
    setVendorPhone(vendor.phone || '');
    setVendorAddress(vendor.address || '');
    setSelectedServices(vendor.handledServices || []);
    setVendorEmailLogin(vendor.emailLogin || ''); 
    setVendorPassword(''); 
    setVendorConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsAddEditDialogOpen(true);
  };

  const openDetailDialog = (vendor: VendorData) => {
    setSelectedVendorForDetail(vendor);
    setIsDetailDialogOpen(true);
  };

  const handleSaveVendor = async () => {
    if (!vendorName || !contactPerson || !vendorEmail || selectedServices.length === 0) {
      toast({ title: "Kesalahan Validasi", description: "Nama Vendor, Kontak Person, Email Kontak, dan minimal satu Layanan harus diisi.", variant: "destructive" });
      return;
    }

    let vendorAuthUid: string | undefined = currentVendor?.authUid;
    const isNewVendor = currentVendor === null;
    const isCreatingCredentialsForExistingVendor = currentVendor !== null && !currentVendor.authUid && vendorEmailLogin.trim() !== '';

    if (isNewVendor || isCreatingCredentialsForExistingVendor) {
      if (!vendorEmailLogin.trim() || !vendorPassword.trim() || !vendorConfirmPassword.trim()) {
        toast({ title: "Kesalahan Validasi Kredensial", description: "Email Login, Password, dan Konfirmasi Password wajib diisi.", variant: "destructive" });
        return;
      }
      if (vendorPassword !== vendorConfirmPassword) {
        toast({ title: "Kesalahan Validasi Kredensial", description: "Password dan Konfirmasi Password tidak cocok.", variant: "destructive" });
        return;
      }
       if (vendorPassword.length < 6) {
        toast({ title: "Kesalahan Validasi Kredensial", description: "Password minimal 6 karakter.", variant: "destructive" });
        return;
      }
      try {
        const signInMethods = await fetchSignInMethodsForEmail(auth, vendorEmailLogin);
        if (signInMethods.length > 0) {
          if (isNewVendor || (currentVendor && currentVendor.emailLogin !== vendorEmailLogin)) {
             toast({ title: "Email Login Sudah Ada", description: `Email login ${vendorEmailLogin} sudah terdaftar. Gunakan email lain.`, variant: "destructive" });
             return;
          }
        }
      } catch (e: any) {
        if (e.code === 'auth/invalid-email') {
            toast({ title: "Format Email Login Salah", description: "Format email untuk login tidak valid.", variant: "destructive" });
            return;
        }
        console.error("Error checking existing login email:", e);
        toast({ title: "Error Validasi Email", description: "Gagal memvalidasi email login.", variant: "destructive" });
        return;
      }
    }

    setIsFormSubmitting(true);

    try {
      if (isNewVendor || isCreatingCredentialsForExistingVendor) {
        const userCredential = await createUserWithEmailAndPassword(auth, vendorEmailLogin, vendorPassword);
        vendorAuthUid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', vendorAuthUid), {
          uid: vendorAuthUid,
          email: vendorEmailLogin,
          displayName: vendorName, 
          role: UserRole.VENDOR,
          photoURL: null, 
        });
      }

      const vendorPayload: Omit<VendorData, 'id' | 'registrationDate'> & { registrationDate?: Timestamp, authUid?: string, emailLogin?: string } = {
        name: vendorName,
        contactPerson,
        email: vendorEmail,
        phone: vendorPhone,
        address: vendorAddress,
        handledServices: selectedServices,
        authUid: vendorAuthUid,
        emailLogin: (isNewVendor || isCreatingCredentialsForExistingVendor) ? vendorEmailLogin : (currentVendor?.emailLogin || '')
      };


      if (currentVendor && currentVendor.id) { 
        const vendorDocRef = doc(db, 'vendors', currentVendor.id);
        await updateDoc(vendorDocRef, vendorPayload);
        setVendors(prev => prev.map(v => v.id === currentVendor.id ? { ...v, ...vendorPayload, registrationDate: v.registrationDate, id: v.id } : v).sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: "Vendor Diperbarui", description: `Vendor ${vendorName} berhasil diperbarui.` });
      } else { 
        const newVendorDataWithTimestamp = {
          ...vendorPayload,
          registrationDate: Timestamp.now(),
        };
        const docRef = await addDoc(vendorsCollectionRef, newVendorDataWithTimestamp);
        setVendors(prev => [...prev, { ...newVendorDataWithTimestamp, id: docRef.id, registrationDate: newVendorDataWithTimestamp.registrationDate.toDate() }].sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: "Vendor Ditambahkan", description: `Vendor ${vendorName} (Login: ${vendorEmailLogin}) berhasil ditambahkan.` });
      }
      setIsAddEditDialogOpen(false);
    } catch (error: any) {
      console.error("Error saving vendor:", error);
      let errorMessage = "Gagal menyimpan vendor.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = `Email login ${vendorEmailLogin} sudah digunakan.`;
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password terlalu lemah. Gunakan minimal 6 karakter.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setIsFormSubmitting(false);
    }
  };
  
  const handleResetPassword = async (vendor: VendorData) => {
    if (!vendor.emailLogin) {
      toast({ title: "Error", description: "Vendor ini tidak memiliki email login terdaftar untuk reset password.", variant: "destructive" });
      return;
    }
    setIsFormSubmitting(true); // Re-use form submitting state for this simple action
    try {
      await sendPasswordResetEmail(auth, vendor.emailLogin);
      toast({ title: "Email Reset Terkirim", description: `Email reset password telah dikirim ke ${vendor.emailLogin}.` });
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      toast({ title: "Error Reset Password", description: error.message, variant: "destructive" });
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const _executeDeleteVendor = async (vendorId: string, vendorNameToDelete: string) => {
    setIsProcessingDelete(true);
    try {
      const vendorDocRef = doc(db, 'vendors', vendorId);
      await deleteDoc(vendorDocRef);
      setVendors(prev => prev.filter(v => v.id !== vendorId));
      toast({ title: "Vendor Dihapus", description: `Vendor ${vendorNameToDelete} berhasil dihapus dari daftar.` });
    } catch (error) {
      console.error("Error deleting vendor:", error);
      toast({ title: "Error", description: "Gagal menghapus vendor.", variant: "destructive" });
    } finally {
      setIsProcessingDelete(false);
      setSupervisionAction(null); // Reset supervision action after completion or error
    }
  };
  
  const openInitialDeleteConfirmDialog = (vendor: VendorData) => {
    setVendorToDelete(vendor); 
  };

  const handleSupervisionPasswordConfirm = async () => {
    if (!supervisionAction || supervisionAction.type !== 'deleteVendor' || !supervisionAction.payload) return;
    setIsVerifyingPassword(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    if (supervisionPasswordInput === PLACEHOLDER_SUPERVISION_PASSWORD) {
        toast({ title: "Password Supervisi Diterima", description: "Melanjutkan proses penghapusan..." });
        setShowSupervisionPasswordDialog(false);
        const vendorPayload = supervisionAction.payload as VendorData;
        if (vendorPayload.id && vendorPayload.name) {
            await _executeDeleteVendor(vendorPayload.id, vendorPayload.name);
        } else {
            console.error("Vendor payload for deletion is missing id or name", vendorPayload);
            toast({ title: "Error Internal", description: "Data vendor tidak lengkap untuk penghapusan.", variant: "destructive" });
            setSupervisionAction(null); // Reset if payload is bad
        }
    } else {
        toast({ title: "Password Supervisi Salah", description: "Penghapusan dibatalkan. Silakan coba lagi.", variant: "destructive" });
    }
    setSupervisionPasswordInput('');
    setIsVerifyingPassword(false);
    // supervisionAction is reset inside _executeDeleteVendor or if password is wrong and user cancels dialog
  };


  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.TEKNISI)) {
    return (
      <Card className="shadow-xl m-4">
        <CardHeader><CardTitle>Akses Ditolak</CardTitle></CardHeader>
        <CardContent><p>Anda tidak memiliki izin untuk melihat halaman ini.</p></CardContent>
      </Card>
    );
  }

  const isDialogFormValid = () => {
    if (!vendorName || !contactPerson || !vendorEmail || selectedServices.length === 0) {
      return false;
    }
    const isNewVendor = currentVendor === null;
    const isCreatingCredsForExisting = currentVendor !== null && !currentVendor.authUid && vendorEmailLogin.trim() !== '';

    if (isNewVendor || isCreatingCredsForExisting) {
      if (!vendorEmailLogin.trim() || !vendorPassword.trim() || vendorPassword !== vendorConfirmPassword || vendorPassword.length < 6) {
        return false;
      }
    }
    return true;
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Store className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl font-bold tracking-tight">Daftar Vendor</CardTitle>
            </div>
            <CardDescription className="text-lg text-muted-foreground">
              Lihat, tambah, edit, atau hapus informasi vendor dan layanan yang ditangani.
            </CardDescription>
          </div>
          <Button onClick={openAddDialog} className="mt-4 md:mt-0">
            <PlusCircle className="mr-2 h-5 w-5" /> Tambah Vendor Baru
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Cari vendor berdasarkan nama, kontak, email kontak..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[200px]">
              <Select value={tokenTypeFilter} onValueChange={setTokenTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter Layanan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Layanan</SelectItem>
                  {TOKEN_TYPE_NAMES.map(token => (
                    <SelectItem key={token.name} value={token.name}>
                      <token.icon className={cn("inline-block mr-2 h-4 w-4", serviceIconColors[token.name] || serviceIconColors.DEFAULT)} />{token.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Memuat data...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Kontak Person</TableHead>
                      <TableHead className="hidden md:table-cell">Layanan</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentVendors.length > 0 ? currentVendors.map((vendor) => {
                      const vendorStatusDescription = generateVendorUsageDescription(vendor.name, allTokenSettings);
                      const isActive = vendorStatusDescription !== 'Belum terhubung ke pengaturan token.';
                      return (
                        <TableRow key={vendor.id}>
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                           <TableCell>
                            {isActive ? (
                              <Badge className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" /> Aktif
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center gap-1 whitespace-nowrap">
                                <XCircle className="h-3 w-3" /> Non Aktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{vendor.contactPerson}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {vendor.handledServices && vendor.handledServices.length > 0
                              ? vendor.handledServices.map(serviceName => {
                                  const tokenInfo = TOKEN_TYPE_NAMES.find(t => t.name === serviceName);
                                  return tokenInfo ? (
                                    <Badge key={serviceName} variant="outline" className="mr-1 mb-1 whitespace-nowrap text-xs py-0.5 px-1.5">
                                      <tokenInfo.icon className={cn("mr-1 h-3 w-3", serviceIconColors[serviceName] || serviceIconColors.DEFAULT)} />
                                      {tokenInfo.label}
                                    </Badge>
                                  ) : null;
                                }).filter(Boolean)
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1 md:space-x-2">
                              <Button variant="outline" size="icon" aria-label={`Detail vendor ${vendor.name}`} onClick={() => openDetailDialog(vendor)}>
                                <Info className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" aria-label={`Edit vendor ${vendor.name}`} onClick={() => openEditDialog(vendor)} disabled={isFormSubmitting || isProcessingDelete}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="icon" aria-label={`Reset password vendor ${vendor.name}`} onClick={() => handleResetPassword(vendor)} disabled={isFormSubmitting || isProcessingDelete || !vendor.emailLogin}>
                                  <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="icon" aria-label={`Hapus vendor ${vendor.name}`} onClick={() => openInitialDeleteConfirmDialog(vendor)} disabled={isFormSubmitting || isProcessingDelete}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">
                          {searchTerm || (tokenTypeFilter && tokenTypeFilter !== 'all') ? "Tidak ada vendor yang cocok dengan filter Anda." : "Belum ada vendor di halaman ini."}
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
                    disabled={currentPage === 1 || isLoading}
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
                        disabled={isLoading}
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
                        disabled={isLoading || !goToPageInput || parseInt(goToPageInput) < 1 || parseInt(goToPageInput) > totalPages}
                        >
                        OK
                        </Button>
                    </div>
                  </div>
                  <Button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages || isLoading}
                    variant="outline"
                    size="sm"
                  >
                    Berikutnya
                  </Button>
                </div>
              )}
              {filteredVendors.length === 0 && !searchTerm && (!tokenTypeFilter || tokenTypeFilter === 'all') && vendors.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground mt-6">Belum ada vendor. Klik &quot;Tambah Vendor Baru&quot; untuk memulai.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentVendor ? 'Edit Vendor' : 'Tambah Vendor Baru'}</DialogTitle>
            <DialogDescription>
              {currentVendor ? 'Perbarui detail untuk vendor ini.' : 'Masukkan detail untuk vendor baru.'} Bidang dengan * wajib diisi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vendorName" className="text-right">Nama Vendor*</Label>
              <Input id="vendorName" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contactPerson" className="text-right">Kontak Person*</Label>
              <Input id="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vendorEmail" className="text-right">Email Kontak*</Label>
              <Input id="vendorEmail" type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vendorPhone" className="text-right">Telepon</Label>
              <Input id="vendorPhone" value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="vendorAddress" className="text-right">Alamat</Label>
              <Input id="vendorAddress" value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} className="col-span-3" />
            </div>

            {/* Login Credentials Section */}
             {(currentVendor === null || (currentVendor && !currentVendor.authUid)) && (
              <>
                <div className="grid grid-cols-4 items-center gap-4 pt-3 border-t">
                  <Label htmlFor="vendorEmailLogin" className="text-right">
                    Email Login*
                    {currentVendor && !currentVendor.authUid && <span className="text-xs text-muted-foreground"> (Baru)</span>}
                  </Label>
                  <Input 
                    id="vendorEmailLogin" 
                    type="email" 
                    value={vendorEmailLogin} 
                    onChange={(e) => setVendorEmailLogin(e.target.value)} 
                    className="col-span-3" 
                    placeholder={currentVendor && !currentVendor.authUid ? "Buat email login baru" : "Untuk login vendor"}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vendorPassword" className="text-right">
                    {currentVendor && !currentVendor.authUid ? "Password Baru*" : "Password*"}
                  </Label>
                  <div className="col-span-3 relative">
                    <Input id="vendorPassword" type={showPassword ? "text" : "password"} value={vendorPassword} onChange={(e) => setVendorPassword(e.target.value)} placeholder="Min. 6 karakter"/>
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={()=>setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff/> : <Eye/>}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="vendorConfirmPassword" className="text-right">
                    {currentVendor && !currentVendor.authUid ? "Konfirmasi Password Baru*" : "Konfirmasi Password*"}
                  </Label>
                   <div className="col-span-3 relative">
                    <Input id="vendorConfirmPassword" type={showConfirmPassword ? "text" : "password"} value={vendorConfirmPassword} onChange={(e) => setVendorConfirmPassword(e.target.value)} placeholder="Ulangi password"/>
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={()=>setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff/> : <Eye/>}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {currentVendor && currentVendor.authUid && (
                <div className="grid grid-cols-4 items-center gap-4 pt-3 border-t">
                    <Label htmlFor="vendorEmailLoginView" className="text-right">Email Login</Label>
                    <Input id="vendorEmailLoginView" type="email" value={currentVendor.emailLogin || ''} readOnly className="col-span-3 bg-muted cursor-not-allowed" />
                </div>
            )}


            <div className="grid grid-cols-4 items-start gap-4 pt-3 border-t">
              <Label className="text-right pt-1 whitespace-nowrap">Layanan*</Label>
              <div className="col-span-3 space-y-2">
                {TOKEN_TYPE_NAMES.map(token => (
                  <div key={token.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={`service-checkbox-${token.name}`}
                      checked={selectedServices.includes(token.name)}
                      onCheckedChange={(checked) => {
                        return checked
                          ? setSelectedServices(prev => [...prev, token.name])
                          : setSelectedServices(prev => prev.filter(s => s !== token.name));
                      }}
                    />
                    <Label htmlFor={`service-checkbox-${token.name}`} className="font-normal flex items-center text-sm">
                      <token.icon className={cn("mr-1.5 h-4 w-4", serviceIconColors[token.name] || serviceIconColors.DEFAULT)} /> {token.label}
                    </Label>
                  </div>
                ))}
                {selectedServices.length === 0 && <p className="text-xs text-destructive text-sm font-medium">Pilih setidaknya satu layanan.</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isFormSubmitting}>Batal</Button>
            </DialogClose>
            <Button 
                onClick={handleSaveVendor} 
                disabled={isFormSubmitting || !isDialogFormValid()}
            >
              {isFormSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan Vendor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Vendor: {selectedVendorForDetail?.name}</DialogTitle>
            <DialogDescription>Informasi lengkap mengenai vendor.</DialogDescription>
          </DialogHeader>
          {selectedVendorForDetail && (
            <div className="grid gap-3 py-4 text-sm max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Nama Vendor:</Label>
                <p className="col-span-2 font-medium">{selectedVendorForDetail.name}</p>
              </div>
               <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Email Login:</Label>
                <p className="col-span-2">{selectedVendorForDetail.emailLogin || '-'}</p>
              </div>
              <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Kontak Person:</Label>
                <p className="col-span-2">{selectedVendorForDetail.contactPerson}</p>
              </div>
              <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Email Kontak:</Label>
                <p className="col-span-2">{selectedVendorForDetail.email}</p>
              </div>
              <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Telepon:</Label>
                <p className="col-span-2">{selectedVendorForDetail.phone || '-'}</p>
              </div>
               <div className="grid grid-cols-3 items-start gap-x-4">
                <Label className="text-right text-muted-foreground pt-0.5">Alamat:</Label>
                <p className="col-span-2">{selectedVendorForDetail.address || '-'}</p>
              </div>
              <div className="grid grid-cols-3 items-start gap-x-4">
                <Label className="text-right text-muted-foreground pt-0.5">Layanan:</Label>
                <div className="col-span-2">
                  {selectedVendorForDetail.handledServices && selectedVendorForDetail.handledServices.length > 0
                    ? selectedVendorForDetail.handledServices.map(serviceName => {
                        const tokenInfo = TOKEN_TYPE_NAMES.find(t => t.name === serviceName);
                        return tokenInfo ? (
                          <Badge key={serviceName} variant="secondary" className="mr-1 mb-1 whitespace-nowrap">
                            <tokenInfo.icon className={cn("mr-1 h-3 w-3", serviceIconColors[serviceName] || serviceIconColors.DEFAULT)} />
                            {tokenInfo.label}
                          </Badge>
                        ) : <Badge key={serviceName} variant="outline" className="mr-1 mb-1">{serviceName}</Badge>;
                      }).filter(Boolean)
                    : <p className="text-muted-foreground">-</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 items-start gap-x-4">
                <Label className="text-right text-muted-foreground pt-0.5">Digunakan Pada:</Label>
                <p className="col-span-2 text-xs">
                  {generateVendorUsageDescription(selectedVendorForDetail.name, allTokenSettings)
                    .split('; ')
                    .map((item, index) => (
                      <span key={index} className="block">
                        {item}
                      </span>
                    ))}
                </p>
              </div>
              <div className="grid grid-cols-3 items-center gap-x-4">
                <Label className="text-right text-muted-foreground">Tgl. Registrasi:</Label>
                <p className="col-span-2">
                  {selectedVendorForDetail.registrationDate instanceof Date
                    ? selectedVendorForDetail.registrationDate.toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Tanggal tidak valid'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {vendorToDelete && (
        <AlertDialog open={!!vendorToDelete} onOpenChange={(open) => !open && setVendorToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda Yakin Ingin Menghapus Vendor?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus data vendor &quot;{vendorToDelete.name}&quot; dari daftar.
                Akun login Firebase terkait ({vendorToDelete.emailLogin || 'tidak ada'}) tidak akan dihapus otomatis dari Firebase Authentication.
                Ini adalah tindakan yang tidak dapat diurungkan sepenuhnya dari sisi aplikasi.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setVendorToDelete(null)} disabled={isProcessingDelete}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (vendorToDelete) {
                    setSupervisionAction({ type: 'deleteVendor', payload: vendorToDelete });
                    setShowSupervisionPasswordDialog(true);
                    setVendorToDelete(null); 
                  }
                }}
                className="bg-destructive hover:bg-destructive/90"
                disabled={isProcessingDelete}
              >
                Lanjutkan ke Konfirmasi Hapus
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
                Untuk melanjutkan penghapusan vendor &quot;{supervisionAction?.payload?.name}&quot;, masukkan password supervisi Anda.
                <br />
                <span className="text-xs text-muted-foreground">(Password demo saat ini: {PLACEHOLDER_SUPERVISION_PASSWORD})</span>
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
            <Button variant="outline" onClick={() => { setShowSupervisionPasswordDialog(false); setSupervisionAction(null); setSupervisionPasswordInput(''); }} disabled={isVerifyingPassword || isProcessingDelete}>
              Batal
            </Button>
            <Button onClick={handleSupervisionPasswordConfirm} disabled={isVerifyingPassword || isProcessingDelete || !supervisionPasswordInput}>
              {(isVerifyingPassword || isProcessingDelete) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konfirmasi Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    
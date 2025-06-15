
'use client';

import { useAuth } from '@/hooks/use-auth';
import { UserRole, type UserProfile } from '@/types';
import { USER_ROLES_HIERARCHY, ROUTES } from '@/lib/constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PlusCircle, Edit3, Trash2, ShieldAlert, UserCog, Search, Loader2, Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { collection, getDocs, query, orderBy, Timestamp, setDoc, doc as firestoreDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { createUserWithEmailAndPassword, updateProfile as updateFirebaseProfile } from 'firebase/auth';
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
  AlertDialogTitle as AlertDialogRadixTitle,
} from "@/components/ui/alert-dialog";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';


const getInitials = (name: string | null | undefined) => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (names.length > 1) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const addUserFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Nama lengkap minimal 2 karakter.' }),
  email: z.string().email({ message: 'Format email tidak valid.' }),
  password: z.string().min(6, { message: 'Password minimal 6 karakter.' }),
  confirmPassword: z.string().min(6, { message: 'Konfirmasi password minimal 6 karakter.' }),
  role: z.nativeEnum(UserRole)
          .refine(role => role === UserRole.ADMIN || role === UserRole.TEKNISI, { message: "Hanya peran Admin atau Teknisi yang dapat dibuat dari sini." })
          .default(UserRole.TEKNISI),
}).refine(data => data.password === data.confirmPassword, {
  message: "Password dan konfirmasi password tidak cocok.",
  path: ["confirmPassword"],
});
type AddUserFormValues = z.infer<typeof addUserFormSchema>;

const editUserFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Nama lengkap minimal 2 karakter.' }),
  role: z.nativeEnum(UserRole)
          .refine(role => role === UserRole.ADMIN || role === UserRole.TEKNISI, { message: "Hanya peran Admin atau Teknisi yang dapat dipilih." })
});
type EditUserFormValues = z.infer<typeof editUserFormSchema>;

const USERS_PER_PAGE = 10;
const FALLBACK_SUPERVISION_PASSWORD = "admin123"; // Fallback if Firestore doc is missing

export default function ManageUsersPage() {
  const { user: adminUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [usersData, setUsersData] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [showPasswordInForm, setShowPasswordInForm] = useState(false);
  const [showConfirmPasswordInForm, setShowConfirmPasswordInForm] = useState(false);

  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  const [showSupervisionPasswordDialog, setShowSupervisionPasswordDialog] = useState(false);
  const [supervisionPasswordInput, setSupervisionPasswordInput] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [supervisionAction, setSupervisionAction] = useState<{ type: 'edit' | 'delete'; payload: UserProfile } | null>(null);
  const [actualSupervisionPassword, setActualSupervisionPassword] = useState<string | null>(null);
  const [isLoadingSupervisionPassword, setIsLoadingSupervisionPassword] = useState(true);


  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState<string>('1');


  const addUserForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
      displayName: '', email: '', password: '', confirmPassword: '', role: UserRole.TEKNISI,
    },
  });

  const editUserForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
  });

  // Fetch actual supervision password from Firestore
  useEffect(() => {
    const fetchSupervisionPassword = async () => {
      setIsLoadingSupervisionPassword(true);
      try {
        const docRef = firestoreDoc(db, 'appConfiguration', 'supervisionSettings');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data()?.password) {
          setActualSupervisionPassword(docSnap.data()?.password);
        } else {
          console.warn("Supervision password document not found or password field missing. Using fallback.");
          setActualSupervisionPassword(FALLBACK_SUPERVISION_PASSWORD); 
        }
      } catch (error) {
        console.error("Error fetching supervision password:", error);
        toast({ title: "Error", description: "Gagal memuat password supervisi. Menggunakan fallback.", variant: "destructive" });
        setActualSupervisionPassword(FALLBACK_SUPERVISION_PASSWORD);
      } finally {
        setIsLoadingSupervisionPassword(false);
      }
    };

    if (adminUser && adminUser.role === UserRole.ADMIN) {
      fetchSupervisionPassword();
    } else {
      setIsLoadingSupervisionPassword(false); // No need to load if not admin
    }
  }, [adminUser, toast]);


  const fetchUsers = useCallback(async () => {
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      setIsLoadingUsers(false);
      setUsersData([]);
      return;
    }
    setIsLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, 'users');
      const q = query(usersCollectionRef, orderBy('displayName', 'asc'));
      const querySnapshot = await getDocs(q);
      const fetchedUsers = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          uid: doc.id, email: data.email, displayName: data.displayName, role: data.role as UserRole, photoURL: data.photoURL,
        } as UserProfile;
      }).filter(u => u.role !== UserRole.CUSTOMER && u.role !== UserRole.VENDOR);
      setUsersData(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Gagal Memuat Pengguna", description: "Tidak dapat mengambil daftar pengguna.", variant: "destructive" });
      setUsersData([]);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [adminUser, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchUsers();
    }
  }, [authLoading, fetchUsers]);

  const allFilteredNonCustomerUsers = useMemo(() => {
    let tempUsers = usersData; 
    if (searchTerm) {
      tempUsers = tempUsers.filter(u =>
        (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return tempUsers;
  }, [searchTerm, usersData]);

  const totalPages = useMemo(() => Math.ceil(allFilteredNonCustomerUsers.length / USERS_PER_PAGE), [allFilteredNonCustomerUsers.length]);
  const currentUsersToDisplay = useMemo(() => {
    const indexOfLastUser = currentPage * USERS_PER_PAGE;
    const indexOfFirstUser = indexOfLastUser - USERS_PER_PAGE;
    return allFilteredNonCustomerUsers.slice(indexOfFirstUser, indexOfLastUser);
  }, [allFilteredNonCustomerUsers, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  useEffect(() => { setGoToPageInput(String(currentPage)); }, [currentPage]);

  const handleNextPage = () => { 
    if(currentPage < totalPages) setCurrentPage(prev => prev + 1);
  }
  const handlePrevPage = () => {
    if(currentPage > 1) setCurrentPage(prev => prev - 1);
  };
  const handleGoToPage = () => {
    const pageNum = parseInt(goToPageInput);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    } else {
      toast({ title: "Halaman Tidak Valid", description: `Masukkan nomor halaman antara 1 dan ${totalPages}.`, variant: "destructive" });
      setGoToPageInput(String(currentPage));
    }
  };


  const handleOpenAddUserDialog = () => {
    addUserForm.reset({ displayName: '', email: '', password: '', confirmPassword: '', role: UserRole.TEKNISI });
    setShowPasswordInForm(false);
    setShowConfirmPasswordInForm(false);
    setIsAddUserDialogOpen(true);
  };

  const handleAddUserSubmit = async (values: AddUserFormValues) => {
    if (!adminUser) {
      toast({ title: "Aksi Ditolak", description: "Sesi admin tidak valid.", variant: "destructive" }); return;
    }
     if (values.role === UserRole.CUSTOMER || values.role === UserRole.VENDOR) {
      toast({ title: "Aksi Ditolak", description: "Tidak dapat membuat pengguna dengan peran Customer/Vendor dari sini.", variant: "destructive" }); return;
    }
    setIsSubmittingUser(true);
    try {
      // Check if email already exists in Firestore (optional, Firebase Auth will also check)
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", values.email), limit(1));
      const emailCheckSnapshot = await getDocs(q);
      if (!emailCheckSnapshot.empty) {
          toast({ title: "Email Sudah Ada", description: "Alamat email ini sudah terdaftar di database pengguna kami.", variant: "destructive" });
          setIsSubmittingUser(false);
          return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const newFirebaseUser = userCredential.user;
      await updateFirebaseProfile(newFirebaseUser, { displayName: values.displayName });
      const newUserProfile: UserProfile = {
        uid: newFirebaseUser.uid, email: newFirebaseUser.email, displayName: values.displayName, role: values.role, photoURL: null,
      };
      await setDoc(firestoreDoc(db, 'users', newFirebaseUser.uid), newUserProfile);
      toast({ title: "Pengguna Ditambahkan", description: `${values.displayName} berhasil ditambahkan sebagai ${USER_ROLES_HIERARCHY[values.role]}.` });
      fetchUsers(); // Refresh user list
      setIsAddUserDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding new user:", error);
      let errorMessage = "Gagal menambahkan pengguna.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "Alamat email ini sudah digunakan oleh akun lain di Firebase Authentication.";
      else if (error.code === 'auth/weak-password') errorMessage = "Password terlalu lemah (min. 6 karakter).";
      else if (error.message) errorMessage = error.message;
      toast({ title: "Gagal Menambahkan", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenEditUserDialog = (userToEdit: UserProfile) => {
    if (adminUser?.role === UserRole.ADMIN) {
      if (isLoadingSupervisionPassword) {
        toast({ title: "Mohon Tunggu", description: "Memuat konfigurasi keamanan...", variant: "default" });
        return;
      }
      if (!actualSupervisionPassword) {
        toast({ title: "Error Konfigurasi", description: "Password supervisi tidak termuat. Tidak dapat melanjutkan.", variant: "destructive"});
        return;
      }
      setSupervisionAction({ type: 'edit', payload: userToEdit });
      setSupervisionPasswordInput('');
      setShowSupervisionPasswordDialog(true);
    } else {
      toast({ title: "Akses Ditolak", description: "Hanya Admin yang dapat mengedit pengguna.", variant: "destructive" });
    }
  };

  const proceedToEditDialog = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit);
    editUserForm.reset({ displayName: userToEdit.displayName || '', role: userToEdit.role });
    setIsEditUserDialogOpen(true);
  };

  const handleEditUserSubmit = async (values: EditUserFormValues) => {
    if (!editingUser || !adminUser || adminUser.role !== UserRole.ADMIN) {
      toast({ title: "Error", description: "Tidak dapat menyimpan perubahan.", variant: "destructive" }); return;
    }
    if (values.role === UserRole.CUSTOMER || values.role === UserRole.VENDOR) {
      toast({ title: "Peran Tidak Valid", description: "Pengguna hanya bisa diedit menjadi Admin atau Teknisi.", variant: "destructive" }); return;
    }
    setIsSubmittingUser(true);
    try {
      const userDocRef = firestoreDoc(db, 'users', editingUser.uid);
      const updates: Partial<UserProfile> = { role: values.role };
      if (values.displayName !== editingUser.displayName) {
        updates.displayName = values.displayName;
        // Firebase Auth user object might not be the one we're editing if admin edits another admin/teknisi.
        // We should only update the Firebase Auth profile if the *currently authenticated admin* is editing *their own* profile.
        // This is better handled in the Profile page. For now, this edit only updates Firestore for other users.
        // If we need to allow admin to change *other* users' Firebase Auth displayName, it requires Admin SDK on backend.
      }
      await updateDoc(userDocRef, updates);
      toast({ title: "Pengguna Diperbarui", description: `${values.displayName} berhasil diperbarui.` });
      fetchUsers();
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({ title: "Gagal Memperbarui", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const openDeleteConfirmDialog = (userToDel: UserProfile) => {
    if (adminUser?.role === UserRole.ADMIN) {
      if (isLoadingSupervisionPassword) {
        toast({ title: "Mohon Tunggu", description: "Memuat konfigurasi keamanan...", variant: "default" });
        return;
      }
       if (!actualSupervisionPassword) {
        toast({ title: "Error Konfigurasi", description: "Password supervisi tidak termuat. Tidak dapat melanjutkan.", variant: "destructive"});
        return;
      }
      setSupervisionAction({ type: 'delete', payload: userToDel });
      setSupervisionPasswordInput('');
      setShowSupervisionPasswordDialog(true);
    } else {
      toast({ title: "Akses Ditolak", description: "Hanya Admin yang dapat menghapus pengguna.", variant: "destructive" });
    }
  };

  const proceedToDeleteUser = (userToDel: UserProfile) => {
    if (userToDel.uid === adminUser?.uid) {
      toast({ title: "Aksi Ditolak", description: "Anda tidak dapat menghapus akun Anda sendiri.", variant: "destructive" }); return;
    }
     if (userToDel.role === UserRole.CUSTOMER || userToDel.role === UserRole.VENDOR) {
      toast({ title: "Aksi Ditolak", description: "Pengguna dengan peran Customer/Vendor tidak dapat dihapus dari sini.", variant: "destructive" }); return;
    }
    setUserToDelete(userToDel);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsProcessingDelete(true);
    try {
      // Deleting user from Firestore. Firebase Auth deletion is a separate, more complex operation
      // typically done server-side or with extreme caution on client.
      await deleteDoc(firestoreDoc(db, "users", userToDelete.uid));
      toast({ title: "Profil Pengguna Dihapus", description: `Profil pengguna ${userToDelete.displayName} telah dihapus dari database aplikasi.` });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user doc:", error);
      toast({ title: "Gagal Menghapus Profil", description: (error as Error).message, variant: "destructive" });
    } finally {
      setUserToDelete(null);
      setIsProcessingDelete(false);
    }
  };

  const handleSupervisionPasswordConfirm = async () => {
    if (!supervisionAction || !actualSupervisionPassword) {
        toast({ title: "Error", description: "Konfigurasi supervisi tidak valid.", variant: "destructive"});
        return;
    }
    setIsVerifyingPassword(true);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    if (supervisionPasswordInput === actualSupervisionPassword) {
      setShowSupervisionPasswordDialog(false);
      if (supervisionAction.type === 'edit' && supervisionAction.payload) {
        proceedToEditDialog(supervisionAction.payload as UserProfile);
      } else if (supervisionAction.type === 'delete' && supervisionAction.payload) {
        proceedToDeleteUser(supervisionAction.payload as UserProfile);
      }
    } else {
      toast({ title: "Password Supervisi Salah", description: "Aksi dibatalkan.", variant: "destructive" });
    }
    setSupervisionPasswordInput('');
    // setSupervisionAction(null); // Keep action until dialog fully closes or for retry
    setIsVerifyingPassword(false);
  };

  if (authLoading && !adminUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Memverifikasi...</p>
      </div>
    );
  }
  if (!adminUser || adminUser.role !== UserRole.ADMIN) {
    return (
      <Card className="shadow-xl m-4"><CardHeader className="items-center text-center"><ShieldAlert className="h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Akses Ditolak</CardTitle><CardDescription>Hanya Administrator.</CardDescription></CardHeader></Card>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1"><UserCog className="h-8 w-8 text-primary" /><CardTitle className="text-3xl font-bold tracking-tight">Kelola Pengguna (Admin/Teknisi)</CardTitle></div>
            <CardDescription className="text-lg text-muted-foreground">Kelola akun internal Admin dan Teknisi aplikasi.</CardDescription>
          </div>
          <Button className="mt-4 md:mt-0" onClick={handleOpenAddUserDialog}><PlusCircle className="mr-2 h-5 w-5" /> Tambah Pengguna</Button>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Cari nama atau email..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={isLoadingUsers && usersData.length === 0} /></div>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3 text-muted-foreground">Memuat...</p></div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-[80px]">Avatar</TableHead><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {currentUsersToDisplay.length > 0 ? currentUsersToDisplay.map((u) => (
                      <TableRow key={u.uid}>
                        <TableCell><Avatar className="h-10 w-10"><AvatarImage src={u.photoURL || ''} alt={u.displayName || 'U'} /><AvatarFallback>{getInitials(u.displayName)}</AvatarFallback></Avatar></TableCell>
                        <TableCell className="font-medium">{u.displayName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>{USER_ROLES_HIERARCHY[u.role]}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="icon" aria-label={`Edit ${u.displayName}`} onClick={() => handleOpenEditUserDialog(u)} disabled={isSubmittingUser || isProcessingDelete || u.uid === adminUser?.uid || isLoadingSupervisionPassword }><Edit3 className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="icon" aria-label={`Hapus ${u.displayName}`} onClick={() => openDeleteConfirmDialog(u)} disabled={u.uid === adminUser?.uid || isProcessingDelete || isSubmittingUser || isLoadingSupervisionPassword}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={5} className="text-center h-24">{searchTerm ? "Tidak ada pengguna cocok." : "Belum ada pengguna Admin/Teknisi."}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
                  <Button onClick={handlePrevPage} disabled={currentPage === 1 || isProcessingDelete || isSubmittingUser || isLoadingUsers} variant="outline" size="sm"><ArrowLeft className="mr-1 h-4 w-4"/>Sebelumnya</Button>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Halaman {currentPage} dari {totalPages}</span>
                    <div className="flex items-center gap-1">
                      <Input type="number" min="1" max={totalPages} value={goToPageInput} onChange={(e) => setGoToPageInput(e.target.value)} onKeyPress={(e) => { if (e.key === 'Enter') handleGoToPage();}} className="h-9 w-16 text-center" placeholder="Ke Hal" disabled={isLoadingUsers || isSubmittingUser || isProcessingDelete}/>
                      <Button onClick={handleGoToPage} variant="outline" size="sm" disabled={isLoadingUsers || isSubmittingUser || isProcessingDelete || !goToPageInput || parseInt(goToPageInput) < 1 || parseInt(goToPageInput) > totalPages || parseInt(goToPageInput) === currentPage}>OK</Button>
                    </div>
                  </div>
                  <Button onClick={handleNextPage} disabled={currentPage === totalPages || isProcessingDelete || isSubmittingUser || isLoadingUsers} variant="outline" size="sm">Berikutnya<ArrowRight className="ml-1 h-4 w-4"/></Button>
                </div>
              )}
            </>
          )}
          {allFilteredNonCustomerUsers.length === 0 && !isLoadingUsers && !searchTerm && (<p className="text-center text-muted-foreground mt-6">Belum ada pengguna Admin/Teknisi.</p>)}
        </CardContent>
      </Card>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Tambah Pengguna (Admin/Teknisi)</DialogTitle><DialogDescription>Peran Customer/Vendor tidak dapat dibuat di sini.</DialogDescription></DialogHeader>
          <Form {...addUserForm}>
            <form onSubmit={addUserForm.handleSubmit(handleAddUserSubmit)} className="space-y-4 py-4">
              <FormField control={addUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input placeholder="Nama Pengguna" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={addUserForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={addUserForm.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><div className="relative"><Input type={showPasswordInForm ? "text":"password"} placeholder="••••••••" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPasswordInForm(!showPasswordInForm)}>{showPasswordInForm ? <EyeOff/>:<Eye/>}</Button></div></FormControl><FormMessage /></FormItem>)} />
              <FormField control={addUserForm.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Konfirmasi Password</FormLabel><FormControl><div className="relative"><Input type={showConfirmPasswordInForm ? "text":"password"} placeholder="••••••••" {...field} /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPasswordInForm(!showConfirmPasswordInForm)}>{showConfirmPasswordInForm ? <EyeOff/>:<Eye/>}</Button></div></FormControl><FormMessage /></FormItem>)} />
              <FormField control={addUserForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Peran</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih peran" /></SelectTrigger></FormControl><SelectContent>{Object.values(UserRole).filter(r => r === UserRole.ADMIN || r === UserRole.TEKNISI).map((rV) => (<SelectItem key={rV} value={rV}>{USER_ROLES_HIERARCHY[rV]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingUser}>Batal</Button></DialogClose><Button type="submit" disabled={isSubmittingUser}>{isSubmittingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { if(!open) setEditingUser(null); setIsEditUserDialogOpen(open);}}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Pengguna: {editingUser?.displayName}</DialogTitle><DialogDescription>Perbarui nama atau peran pengguna.</DialogDescription></DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(handleEditUserSubmit)} className="space-y-4 py-4">
              <FormField control={editUserForm.control} name="displayName" render={({ field }) => (<FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input placeholder="Nama Pengguna" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editUserForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Peran</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Pilih peran" /></SelectTrigger></FormControl><SelectContent>{Object.values(UserRole).filter(r => r === UserRole.ADMIN || r === UserRole.TEKNISI).map((rV) => (<SelectItem key={rV} value={rV}>{USER_ROLES_HIERARCHY[rV]}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={isSubmittingUser}>Batal</Button></DialogClose><Button type="submit" disabled={isSubmittingUser}>{isSubmittingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Perubahan</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showSupervisionPasswordDialog} onOpenChange={(isOpen) => { if(!isOpen) { setSupervisionAction(null); setSupervisionPasswordInput('');} setShowSupervisionPasswordDialog(isOpen);}}>
        <DialogContent className="sm:max-w-md">
          {supervisionAction && supervisionAction.payload ? (
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <ShieldAlert className="h-6 w-6 mr-2 text-orange-500" />
                Memerlukan Password Supervisi
              </DialogTitle>
              <DialogDescription>
                Untuk melanjutkan aksi ini ({supervisionAction.type === 'edit' ? `mengedit ${supervisionAction.payload.displayName || 'pengguna yang dipilih'}` : `menghapus ${supervisionAction.payload.displayName || 'pengguna yang dipilih'}`}), masukkan password supervisi Anda.
              </DialogDescription>
            </DialogHeader>
          ) : (
             <DialogHeader>
                <DialogTitle className="flex items-center">
                  <ShieldAlert className="h-6 w-6 mr-2 text-orange-500" />
                  Memerlukan Password Supervisi
                </DialogTitle>
                <DialogDescription>
                  Masukkan password supervisi Anda untuk melanjutkan.
                </DialogDescription>
              </DialogHeader>
          )}
          <div className="grid gap-4 py-4"><div className="space-y-2"><Label htmlFor="supervision-password">Password Supervisi</Label><Input id="supervision-password" type="password" value={supervisionPasswordInput} onChange={(e) => setSupervisionPasswordInput(e.target.value)} placeholder="Masukkan password" /></div></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSupervisionPasswordDialog(false); setSupervisionAction(null); setSupervisionPasswordInput(''); }} disabled={isVerifyingPassword}>Batal</Button>
            <Button onClick={handleSupervisionPasswordConfirm} disabled={isVerifyingPassword || isLoadingSupervisionPassword || !supervisionPasswordInput}>
                {(isVerifyingPassword || isLoadingSupervisionPassword) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoadingSupervisionPassword ? 'Memuat...' : 'Konfirmasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userToDelete && (
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent><AlertDialogHeader><AlertDialogRadixTitle>Anda Yakin?</AlertDialogRadixTitle>
              <AlertDialogDescription>Hapus profil &quot;{userToDelete.displayName}&quot; dari DB Aplikasi? Akun login Firebase Auth ({userToDelete.email || 'N/A'}) TIDAK akan dihapus otomatis.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel onClick={() => setUserToDelete(null)} disabled={isProcessingDelete}>Batal</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90" disabled={isProcessingDelete}>{isProcessingDelete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ya, Hapus Profil Aplikasi</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


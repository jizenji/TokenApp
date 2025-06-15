
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { Loader2, UploadCloud, XCircle, KeyRound, Eye, EyeOff, ShieldCheck, User as UserIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { auth, db } from '@/config/firebase';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { UserRole } from '@/types';
import { USER_ROLES_HIERARCHY, ROUTES } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label'; // Pastikan Label diimpor

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Display name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  photoFile: z.custom<File | null>(
    (file) => file === null || file instanceof File,
    "Invalid file type"
  )
  .optional()
  .refine(
    (file) => !file || file.size <= MAX_FILE_SIZE,
    `Max image size is 2MB.`
  )
  .refine(
    (file) => !file || ALLOWED_IMAGE_TYPES.includes(file.type),
    "Only .jpg, .jpeg, .png, .webp and .gif formats are supported."
  ),
});

export default function ProfilePage() {
  const { user, loading: authLoading, updateUserFirebaseProfile, sendPasswordReset } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(user?.photoURL || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [newSupervisionPassword, setNewSupervisionPassword] = useState('');
  const [confirmSupervisionPassword, setConfirmSupervisionPassword] = useState('');
  const [showNewSupervisionPassword, setShowNewSupervisionPassword] = useState(false);
  const [showConfirmSupervisionPassword, setShowConfirmSupervisionPassword] = useState(false);
  const [isSavingSupervisionPassword, setIsSavingSupervisionPassword] = useState(false);
  const [supervisionPasswordError, setSupervisionPasswordError] = useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      email: user?.email || '',
      photoFile: null,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        email: user.email || '',
        photoFile: null,
      });
      setImagePreview(user.photoURL || null);
      setSelectedFile(null);
    }
  }, [user, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        form.setError("photoFile", { type: "manual", message: "Max image size is 2MB." });
        setSelectedFile(null);
        setImagePreview(user?.photoURL || null);
        form.setValue('photoFile', null);
        return;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        form.setError("photoFile", { type: "manual", message: "Only .jpg, .jpeg, .png, .webp and .gif formats are supported." });
        setSelectedFile(null);
        setImagePreview(user?.photoURL || null);
        form.setValue('photoFile', null);
        return;
      }

      form.clearErrors("photoFile");
      setSelectedFile(file);
      form.setValue('photoFile', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(user?.photoURL || null);
    form.setValue('photoFile', null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  async function onSubmitProfile(values: z.infer<typeof profileFormSchema>) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (!auth.currentUser && user.role === UserRole.CUSTOMER) {
        let nameUpdated = false;
        if (values.displayName !== user.displayName && !(user.role === UserRole.VENDOR)) {
          const customerDocRef = doc(db, 'customers', user.uid);
          await updateDoc(customerDocRef, { customerName: values.displayName });
          nameUpdated = true;
           user.displayName = values.displayName;
          toast({ title: "Profile Updated", description: "Your display name has been updated." });
        }

        if (selectedFile) {
          toast({ title: "Info", description: "Photo updates are not currently supported for this account type.", variant: "default" });
        }

        if (!nameUpdated && !selectedFile) {
             toast({ title: "No Changes", description: "No changes were made to your profile." });
        }

      } else if (auth.currentUser) {
        const updates: { displayName?: string; photoURL?: string } = {};
        let hasChanges = false;

        const isDisplayNameLockedForVendor = user.role === UserRole.VENDOR;

        if (values.displayName !== user.displayName && !isDisplayNameLockedForVendor) {
          updates.displayName = values.displayName;
          hasChanges = true;
        } else if (isDisplayNameLockedForVendor && values.displayName !== user.displayName) {
            console.warn("Attempted to submit a changed display name for a locked field. Ignoring change.");
        }

        if (selectedFile) {
          const reader = new FileReader();
          const dataUrlPromise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
          updates.photoURL = await dataUrlPromise;
          hasChanges = true;
        }

        if (!hasChanges) {
          toast({ title: "No Changes", description: "No changes were made to your profile." });
        } else {
          await updateUserFirebaseProfile(updates);
        }
      } else {
         toast({ title: "Error", description: "User session is not clear. Cannot update profile.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Profile update submission error in form:", error);
      toast({ title: "Update Failed", description: (error as Error).message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePasswordReset = async () => {
    if (user && user.email && auth.currentUser) {
      try {
        await sendPasswordReset(user.email);
      } catch (e) {
        // Error already handled by toast in auth context
      }
    } else if (user && user.email && !auth.currentUser && user.role === UserRole.CUSTOMER) {
        toast({
            title: "Info",
            description: "Reset password tidak berlaku untuk akun pelanggan yang login tanpa autentikasi Firebase.",
            variant: "default",
        });
    } else {
      toast({
        title: "Email Tidak Ditemukan",
        description: "Tidak dapat mengirim email reset password karena email tidak terdaftar atau pengguna tidak valid.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSupervisionPassword = async () => {
    setSupervisionPasswordError('');
    if (!newSupervisionPassword || !confirmSupervisionPassword) {
      setSupervisionPasswordError("Semua field password supervisi harus diisi.");
      return;
    }
    if (newSupervisionPassword.length < 6) {
      setSupervisionPasswordError("Password supervisi minimal 6 karakter.");
      return;
    }
    if (newSupervisionPassword !== confirmSupervisionPassword) {
      setSupervisionPasswordError("Password supervisi baru dan konfirmasi tidak cocok.");
      return;
    }
    setIsSavingSupervisionPassword(true);
    try {
      const supervisionSettingsRef = doc(db, 'appConfiguration', 'supervisionSettings');
      await setDoc(supervisionSettingsRef, { password: newSupervisionPassword }, { merge: true });
      toast({ title: "Password Supervisi Disimpan", description: "Password supervisi baru telah berhasil disimpan." });
      setNewSupervisionPassword('');
      setConfirmSupervisionPassword('');
    } catch (error) {
      console.error("Error saving supervision password:", error);
      toast({ title: "Gagal Menyimpan", description: "Gagal menyimpan password supervisi.", variant: "destructive" });
      setSupervisionPasswordError("Gagal menyimpan. Silakan coba lagi.");
    } finally {
      setIsSavingSupervisionPassword(false);
    }
  };


  if (authLoading) {
    return <div className="container mx-auto py-8"><p>Loading profile...</p></div>;
  }

  if (!user) {
    return <div className="container mx-auto py-8"><p>User not found. Please log in.</p></div>;
  }

  const isVendor = user.role === UserRole.VENDOR;
  const isFirebaseAuthenticatedUser = !!auth.currentUser;

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex flex-col items-center space-y-4 md:flex-row md:space-y-0 md:space-x-6 mb-4">
            <Avatar className="h-24 w-24 border-2 border-primary shadow-md">
              <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
              <AvatarFallback className="text-3xl">{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div className="text-center md:text-left">
              <CardTitle className="text-3xl font-bold tracking-tight flex items-center">
                <UserIcon className="mr-2 h-8 w-8 text-primary hidden md:inline-block" />
                {user.displayName || 'User Profile'}
              </CardTitle>
              <CardDescription className="text-lg text-muted-foreground mt-1">
                {USER_ROLES_HIERARCHY[user.role]} at {process.env.NEXT_PUBLIC_APP_NAME || 'Our Company'}
              </CardDescription>
            </div>
          </div>
           <CardDescription className="text-center md:text-left text-md text-muted-foreground">
            Lihat dan perbarui informasi personal Anda di bawah ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitProfile)} className="space-y-8">
              <FormField
                control={form.control}
                name="photoFile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foto Profil</FormLabel>
                    <div className="flex items-center gap-4">
                      <Avatar className="h-20 w-20 border">
                        <AvatarImage src={imagePreview || undefined} alt={user.displayName || 'User'} />
                        <AvatarFallback className="text-2xl">{getInitials(user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting || !isFirebaseAuthenticatedUser}
                        >
                          <UploadCloud className="mr-2 h-4 w-4" /> Ubah Foto
                        </Button>
                        <FormControl>
                          <Input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            disabled={isSubmitting || !isFirebaseAuthenticatedUser}
                          />
                        </FormControl>
                        {imagePreview && imagePreview !== user.photoURL && selectedFile && (
                           <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveImage}
                              className="text-destructive hover:text-destructive"
                              disabled={isSubmitting}
                           >
                             <XCircle className="mr-2 h-4 w-4" /> Hapus Pilihan
                           </Button>
                        )}
                      </div>
                    </div>
                    <FormDescription>
                      Unggah foto profil baru. Ukuran file maks: 2MB.
                      {!isFirebaseAuthenticatedUser && " Unggah foto profil tidak tersedia untuk tipe akun ini."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Tampilan</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nama Anda"
                        {...field}
                        disabled={isSubmitting || isVendor}
                        className={cn(isVendor && "bg-muted/70 cursor-not-allowed")}
                      />
                    </FormControl>
                    <FormDescription>
                      {isVendor
                        ? "Nama tampilan tidak dapat diubah untuk akun Vendor dari halaman ini."
                        : "Ini adalah nama publik Anda."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@anda.com" {...field} disabled />
                    </FormControl>
                    <FormDescription>Alamat email Anda tidak dapat diubah di sini.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmitting || authLoading}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Perubahan Profil
              </Button>
            </form>
          </Form>

          {isFirebaseAuthenticatedUser && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-md font-semibold mb-2 text-foreground">Keamanan Akun</h3>
              <div className="space-y-2">
                <Label htmlFor="email-display-auth" className="text-sm text-muted-foreground">Email Akun:</Label>
                <Input id="email-display-auth" value={user.email || ''} readOnly className="bg-muted/50 cursor-not-allowed" />
              </div>
              <Button
                variant="outline"
                onClick={handlePasswordReset}
                disabled={authLoading || !user.email}
                className="mt-3"
              >
                {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <KeyRound className="mr-2 h-4 w-4" />
                Reset / Ubah Password via Email
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Anda akan menerima email untuk mereset password akun Firebase Anda.
              </p>
            </div>
          )}

          {user.role === UserRole.ADMIN && (
            <div className="mt-8 pt-6 border-t">
              <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center">
                <ShieldCheck className="mr-2 h-5 w-5 text-primary"/>
                Manajemen Password Supervisi
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="newSupervisionPassword">Password Supervisi Baru</Label>
                  <div className="relative">
                    <Input
                      id="newSupervisionPassword"
                      type={showNewSupervisionPassword ? 'text' : 'password'}
                      value={newSupervisionPassword}
                      onChange={(e) => setNewSupervisionPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="pr-10"
                      disabled={isSavingSupervisionPassword}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewSupervisionPassword(!showNewSupervisionPassword)}
                      disabled={isSavingSupervisionPassword}
                    >
                      {showNewSupervisionPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmSupervisionPassword">Konfirmasi Password Supervisi Baru</Label>
                   <div className="relative">
                    <Input
                      id="confirmSupervisionPassword"
                      type={showConfirmSupervisionPassword ? 'text' : 'password'}
                      value={confirmSupervisionPassword}
                      onChange={(e) => setConfirmSupervisionPassword(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="pr-10"
                      disabled={isSavingSupervisionPassword}
                    />
                     <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowConfirmSupervisionPassword(!showConfirmSupervisionPassword)}
                      disabled={isSavingSupervisionPassword}
                    >
                      {showConfirmSupervisionPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {supervisionPasswordError && <p className="text-sm text-destructive">{supervisionPasswordError}</p>}
                <Button
                  type="button"
                  onClick={handleSaveSupervisionPassword}
                  disabled={isSavingSupervisionPassword}
                >
                  {isSavingSupervisionPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Password Supervisi
                </Button>
              </div>
               <p className="text-xs text-muted-foreground mt-2">
                  Password supervisi ini akan digunakan untuk mengotorisasi tindakan administratif penting lainnya.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="mt-6 border-t pt-6">
            <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto ml-auto">
                Tutup
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

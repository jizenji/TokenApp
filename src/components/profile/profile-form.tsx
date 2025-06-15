
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
import { useState } from 'react';
import { Loader2, UploadCloud, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { auth, db } from '@/config/firebase'; // Import auth and db
import { doc, updateDoc } from 'firebase/firestore'; // Import doc and updateDoc
import { cn } from '@/lib/utils';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const profileFormSchema = z.object({
  displayName: z.string().min(2, { message: 'Display name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  photoFile: z.custom<File | null>(
    (file) => file === null || file instanceof File, // Allow null or File
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

interface ProfileFormProps {
  isDisplayNameLocked?: boolean;
}

export function ProfileForm({ isDisplayNameLocked = false }: ProfileFormProps) {
  const { user, loading: authLoading, updateUserFirebaseProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(user?.photoURL || null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
  
  React.useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || '',
        email: user.email || '',
        photoFile: null, // Reset file input on user change
      });
      setImagePreview(user.photoURL || null); // Update preview with current user photo
      setSelectedFile(null); // Clear selected file
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

  async function onSubmit(values: z.infer<typeof profileFormSchema>) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (!auth.currentUser && user.role === 'customer') { // Non-Firebase Auth Customer
        let nameUpdated = false;
        if (values.displayName !== user.displayName && !isDisplayNameLocked) {
          const customerDocRef = doc(db, 'customers', user.uid); 
          await updateDoc(customerDocRef, { customerName: values.displayName });
          nameUpdated = true;
          // Manually update context for immediate reflection for non-Firebase Auth user
           user.displayName = values.displayName; 
          toast({ title: "Profile Updated", description: "Your display name has been updated." });
        }

        if (selectedFile) {
          toast({ title: "Info", description: "Photo updates are not currently supported for this account type.", variant: "default" });
        }
        
        if (!nameUpdated && !selectedFile) {
             toast({ title: "No Changes", description: "No changes were made to your profile." });
        }

      } else if (auth.currentUser) { // Firebase Authenticated user (Admin, Teknisi, Vendor)
        const updates: { displayName?: string; photoURL?: string } = {};
        let hasChanges = false;

        if (values.displayName !== user.displayName && !isDisplayNameLocked) {
          updates.displayName = values.displayName;
          hasChanges = true;
        } else if (isDisplayNameLocked && values.displayName !== user.displayName) {
            // Prevent accidental submission of locked display name if form state somehow differs
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
          await updateUserFirebaseProfile(updates); // Calls AuthContext function
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

  if (authLoading) return <p>Loading profile...</p>;
  if (!user) return <p>User not found.</p>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        
        <FormField
          control={form.control}
          name="photoFile"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Profile Picture</FormLabel>
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
                    disabled={isSubmitting || (!auth.currentUser && user.role === 'customer')} 
                  >
                    <UploadCloud className="mr-2 h-4 w-4" /> Change Picture
                  </Button>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      disabled={isSubmitting || (!auth.currentUser && user.role === 'customer')} 
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
                       <XCircle className="mr-2 h-4 w-4" /> Remove
                     </Button>
                  )}
                </div>
              </div>
              <FormDescription>
                Upload a new profile picture. Max file size: 2MB.
                Supported formats: JPG, PNG, WEBP, GIF.
                {(!auth.currentUser && user.role === 'customer') && " Photo uploads are not available for this account type."}
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
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Your Name"
                  {...field}
                  disabled={isSubmitting || isDisplayNameLocked}
                  className={cn(isDisplayNameLocked && "bg-muted/70 cursor-not-allowed")}
                />
              </FormControl>
              <FormDescription>
                {isDisplayNameLocked
                  ? "Display name tidak dapat diubah untuk akun Vendor dari halaman ini."
                  : "This is your public display name."}
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
                <Input type="email" placeholder="your.email@example.com" {...field} disabled />
              </FormControl>
              <FormDescription>Your email address cannot be changed here.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting || authLoading}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </form>
    </Form>
  );
}

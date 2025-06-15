
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, updateDoc } from 'firebase/firestore';
import type { UserProfile, CustomerData } from '@/types';
import { UserRole } from '@/types';
import { ROUTES } from '@/lib/constants';
import { useToast } from "@/hooks/use-toast";

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, displayName: string, role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateUserFirebaseProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [justCustomLoggedIn, setJustCustomLoggedIn] = useState(false);


  useEffect(() => {
    console.log('[AuthContext] useEffect for onAuthStateChanged runs.');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log('[AuthContext] onAuthStateChanged triggered. firebaseUser:', firebaseUser ? firebaseUser.email : 'null');
      if (firebaseUser) {
        setJustCustomLoggedIn(false); 
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userProfileData = userDocSnap.data() as UserProfile;
          
          // Prefer Firestore photoURL if it exists, otherwise Firebase Auth's
          const firestorePhotoURL = userProfileData.photoURL;
          const authPhotoURL = firebaseUser.photoURL;

          if (firestorePhotoURL) {
            userProfileData.photoURL = firestorePhotoURL;
          } else if (authPhotoURL) {
            userProfileData.photoURL = authPhotoURL;
            // Optionally sync Firebase Auth photoURL to Firestore if Firestore's is missing
            // await updateDoc(userDocRef, { photoURL: authPhotoURL });
          }

          const currentAuthDisplayName = firebaseUser.displayName;
          if (currentAuthDisplayName && currentAuthDisplayName !== userProfileData.displayName) {
            userProfileData.displayName = currentAuthDisplayName;
          }

          console.log('[AuthContext] Firebase user profile found/updated. Setting user state:', userProfileData.email, 'Role:', userProfileData.role);
          setUser(userProfileData);
        } else {
          console.warn(`[AuthContext] Firebase user session for ${firebaseUser.email}, but no profile in "users" collection. Creating default.`);
          const newUserProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email || 'New User',
            role: UserRole.CUSTOMER, 
            photoURL: firebaseUser.photoURL,
          };
          await setDoc(userDocRef, newUserProfile);
          setUser(newUserProfile);
          toast({ title: "Profil Dibuat", description: "Profil pengguna baru telah dibuat dengan peran default Customer."});
        }
      } else {
        if (!justCustomLoggedIn) {
            console.log('[AuthContext] No Firebase user and not just custom logged in. Setting user to null.');
            setUser(null);
        } else {
            console.log('[AuthContext] No Firebase user, but custom login flag is set. Retaining custom user state for this session.');
        }
      }
      setLoading(false);
      console.log('[AuthContext] Auth loading finished. Current app user state:', user ? user.email : 'null');
    });

    return () => unsubscribe();
  }, [justCustomLoggedIn, toast]); 

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setJustCustomLoggedIn(false);
    console.log('[AuthContext] LOGIN_START: Attempting login for email:', email);

    try {
      // 1. Try custom login for customers
      console.log('[AuthContext] LOGIN_CUSTOMER_CHECK_START: Checking "customers" collection.');
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where("customerEmail", "==", email), limit(1));
      const querySnapshot = await getDocs(q);
      console.log('[AuthContext] LOGIN_CUSTOMER_CHECK_END: "customers" collection check complete. Found:', querySnapshot.size);

      if (!querySnapshot.empty) {
        const customerDoc = querySnapshot.docs[0];
        const customerData = customerDoc.data() as CustomerData;
        console.log('[AuthContext] LOGIN_CUSTOMER_FOUND: Customer found in "customers" collection:', customerData.customerName);

        if (customerData.customerPassword === pass) {
          const customerProfile: UserProfile = {
            uid: customerDoc.id, 
            email: customerData.customerEmail,
            displayName: customerData.customerName,
            role: UserRole.CUSTOMER,
            photoURL: undefined, // Customers logged in this way won't have Firebase Auth photoURL
            isTransactionActive: customerData.isTransactionActive !== undefined ? customerData.isTransactionActive : true,
          };
          setUser(customerProfile);
          setJustCustomLoggedIn(true);
          console.log('[AuthContext] LOGIN_CUSTOMER_SUCCESS: Custom login successful. User state set. Loading false. Redirecting.');
          toast({ title: "Login Berhasil (Pelanggan)", description: `Selamat datang, ${customerData.customerName}!` });
          setLoading(false); 
          router.push(ROUTES.DASHBOARD);
          return;
        } else {
          console.warn('[AuthContext] LOGIN_CUSTOMER_PASSWORD_MISMATCH: Customer found, but password mismatch. Proceeding to Firebase Auth.');
        }
      } else {
        console.log('[AuthContext] LOGIN_CUSTOMER_NOT_FOUND: No customer found with that email in "customers" collection. Proceeding to Firebase Auth.');
      }

      // 2. If custom login didn't succeed or wasn't applicable, try Firebase Auth
      console.log('[AuthContext] LOGIN_FIREBASE_AUTH_START: Attempting Firebase Authentication for email:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      console.log('[AuthContext] LOGIN_FIREBASE_AUTH_SUCCESS: signInWithEmailAndPassword call successful for Firebase user UID:', userCredential.user.uid, '. Awaiting onAuthStateChanged to set user profile and complete loading state.');
      

    } catch (error: any) {
      console.error("[AuthContext] LOGIN_ERROR: Login attempt failed.", error);
      let errorMessage = "Email atau password tidak valid."; 
      
      if (error.code) {
          console.log("[AuthContext] LOGIN_ERROR_CODE:", error.code, "Message:", error.message);
          if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
              errorMessage = "Email atau password tidak valid.";
          } else if (error.code === 'auth/invalid-email') {
              errorMessage = "Format email tidak valid.";
          } else if (error.code === 'auth/network-request-failed') {
              errorMessage = "Gagal terhubung ke server autentikasi. Periksa koneksi internet Anda.";
          } else if (error.code === 'auth/too-many-requests') {
              errorMessage = "Terlalu banyak percobaan login. Coba lagi nanti atau reset password Anda.";
          } else if (error.message && !error.message.toLowerCase().includes("auth/")) { 
             errorMessage = `Terjadi kesalahan pada sistem: ${error.message}`;
             console.warn("[AuthContext] Potential non-auth error during login sequence:", error.message);
          } else {
             errorMessage = error.message || "Terjadi kesalahan saat login."; 
          }
      } else if (error.message) {
        errorMessage = error.message; 
      }
      
      toast({ title: "Login Gagal", description: errorMessage, variant: "destructive" });
      setUser(null);
      setJustCustomLoggedIn(false);
      setLoading(false); 
      console.log('[AuthContext] LOGIN_ERROR_HANDLED: User set to null, loading false.');
    }
  };

  const signup = async (email: string, pass: string, displayName: string, role: UserRole = UserRole.CUSTOMER) => {
    setLoading(true);
    setJustCustomLoggedIn(false);
    console.log('[AuthContext] Attempting Firebase signup for email:', email);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      
      await updateProfile(firebaseUser, { displayName });

      const newUserProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: displayName,
        role: role,
        photoURL: firebaseUser.photoURL, 
      };
      await setDoc(doc(db, 'users', firebaseUser.uid), newUserProfile);
      console.log('[AuthContext] Firebase signup successful. User profile created in "users" and Firebase Auth profile updated.');
      toast({ title: "Pendaftaran Berhasil", description: "Selamat datang!" });
      
    } catch (error: any) {
      console.error("[AuthContext] Signup error:", error);
      if (error.code === 'auth/configuration-not-found') {
        toast({
          title: "Signup Failed: Configuration Error",
          description: "Email/Password sign-in method is not enabled in your Firebase project. Please enable it in the Firebase console (Authentication > Sign-in method).",
          variant: "destructive",
          duration: 10000,
        });
      } else if (error.code === 'auth/email-already-in-use') {
         toast({ title: "Signup Failed", description: "Alamat email ini sudah digunakan oleh akun lain.", variant: "destructive" });
      }
      else {
        toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      throw error;
    }
  };

  const updateUserFirebaseProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) {
      toast({ title: "Update Error", description: "No user is currently signed in.", variant: "destructive" });
      throw new Error("No user signed in");
    }

    try {
      const firebaseAuthUpdates: { displayName?: string; photoURL?: string } = {};
      if (updates.displayName !== undefined) {
        firebaseAuthUpdates.displayName = updates.displayName;
      }
      // Only attempt to update Firebase Auth photoURL if it's a real URL (not a Data URI)
      if (updates.photoURL !== undefined && updates.photoURL !== null && !updates.photoURL.startsWith('data:')) {
        firebaseAuthUpdates.photoURL = updates.photoURL;
      } else if (updates.photoURL === null) { // Allow explicitly clearing the photoURL
        firebaseAuthUpdates.photoURL = null;
      }

      if (Object.keys(firebaseAuthUpdates).length > 0) {
        await updateProfile(auth.currentUser, firebaseAuthUpdates);
      }
      
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const firestoreUpdates: Partial<UserProfile> = {};
      if (updates.displayName !== undefined) {
        firestoreUpdates.displayName = updates.displayName;
      }
      // Always update Firestore photoURL with the provided value (can be Data URI or real URL)
      if (updates.photoURL !== undefined) {
        firestoreUpdates.photoURL = updates.photoURL;
      }


      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
      }
      
      setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = { ...prevUser };
        if (updates.displayName !== undefined) {
          updatedUser.displayName = updates.displayName;
        }
        if (updates.photoURL !== undefined) { 
          updatedUser.photoURL = updates.photoURL;
        }
        console.log('[AuthContext] Manually updated user state after profile update:', updatedUser);
        return updatedUser;
      });

      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      let detailedMessage = error.message || "An unexpected error occurred.";
      if (error.code === 'auth/invalid-profile-attribute' && error.message.includes('photo URL')) {
          detailedMessage = "The photo URL format was invalid for Firebase Auth. It has been updated in your app profile but not directly in Firebase Auth.";
          console.warn("Attempted to set invalid photoURL (likely Data URI) to Firebase Auth. Saved to Firestore instead.");
      }
      toast({ title: "Update Failed", description: detailedMessage, variant: "destructive" });
      throw error;
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Email Reset Password Terkirim",
        description: `Silakan cek inbox email ${email} untuk instruksi reset password.`,
      });
    } catch (error: any) {
      console.error("[AuthContext] Send Password Reset Error:", error);
      let errorMessage = "Gagal mengirim email reset password.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "Tidak ada pengguna yang terdaftar dengan email ini.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast({
        title: "Gagal Mengirim Email Reset",
        description: errorMessage,
        variant: "destructive",
      });
      throw error; 
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log('[AuthContext] Logout initiated.');
    setLoading(true);
    const currentEmail = user?.email; 
    setJustCustomLoggedIn(false); 
    try {
      await firebaseSignOut(auth); 
      setUser(null); 
      router.push(ROUTES.LOGIN);
      toast({ title: "Logged Out", description: "Anda telah berhasil keluar." });
      console.log(`[AuthContext] Logout successful for user: ${currentEmail || 'N/A'}. Firebase signOut and user state cleared.`);
    } catch (error: any) {
      console.error("[AuthContext] Logout error:", error);
      toast({ title: "Logout Failed", description: error.message, variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[AuthContext] Redirection useEffect. loading:', loading, 'user:', user ? user.email : 'null', 'pathname:', pathname, 'justCustomLoggedIn:', justCustomLoggedIn);
    if (!loading) {
      if (!user && !justCustomLoggedIn && pathname !== ROUTES.LOGIN && pathname !== ROUTES.SIGNUP) {
        console.log('[AuthContext] Not loading, no user/custom session, not on auth pages. Redirecting to LOGIN.');
        router.replace(ROUTES.LOGIN);
      }
      if (user && pathname === ROUTES.LOGIN) {
        console.log('[AuthContext] Not loading, user exists, on LOGIN page. Redirecting to DASHBOARD.');
        router.replace(ROUTES.DASHBOARD);
      }
    }
  }, [user, loading, pathname, router, justCustomLoggedIn]);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUserFirebaseProfile, sendPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
};


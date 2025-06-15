
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/constants';
import { UserRole } from '@/types';
import { Header } from '@/components/layout/header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { AdminSidebar } from '@/components/layout/admin-sidebar'; // New import
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(ROUTES.LOGIN);
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
        <div className="flex h-screen items-center justify-center">
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg font-medium text-muted-foreground">Memuat aplikasi...</span>
          </div>
        </div>
    );
  }
  
  const isAdmin = user.role === UserRole.ADMIN;
  const isCustomer = user.role === UserRole.CUSTOMER; // For customer-specific theme

  return (
    <div className={cn(
        "flex flex-col min-h-screen",
        // Apply customer theme only if customer AND NOT admin
        isCustomer && !isAdmin 
          ? "theme-customer-special bg-gradient-to-b from-[hsl(var(--customer-gradient-from-l))] to-[hsl(var(--customer-gradient-to-l))] dark:from-[hsl(var(--customer-gradient-from-d))] dark:to-[hsl(var(--customer-gradient-to-d))]" 
          // Admin and Teknisi get standard background
          : "bg-background" 
      )}
    >
      <Header />
      {isAdmin && <AdminSidebar />} {/* Render AdminSidebar if admin */}
      <main className={cn(
        "flex-1 overflow-y-auto p-6",
        // If admin, add left margin for sidebar on desktop.
        // If not admin, add bottom padding for BottomNav.
        isAdmin ? "md:ml-64" : "pb-20",
        // Apply bg-background to main content area for Admin and Teknisi.
        // For Customer, theme-customer-special sets --background to transparent.
        (isAdmin || !isCustomer) && "bg-background"
      )}>
        {children}
      </main>
      {!isAdmin && <BottomNav />} {/* Render BottomNav if NOT admin */}
    </div>
  );
}


'use client';

// Removed SidebarTrigger import
import { UserNav } from '@/components/layout/user-nav';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { PocketKnife } from 'lucide-react';
import { APP_NAME, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';


export function Header() {
  const { user, loading } = useAuth();
  const isCustomer = user?.role === UserRole.CUSTOMER;
  const isAdmin = user?.role === UserRole.ADMIN; // Variable to check if user is admin

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full border-b shadow-sm",
        isCustomer
          ? "customer-header-bg customer-header-border"
          : "border-[hsl(var(--header-border))] bg-[hsl(var(--header-bg))] text-[hsl(var(--header-foreground))]"
      )}
    >
      <div className={cn(
        "container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8",
        isAdmin && "md:ml-64" // Apply left margin if admin on medium screens and up
      )}>
        <div className="flex items-center">
          {/* SidebarTrigger removed */}
           <Link
            href={ROUTES.DASHBOARD}
            className={cn(
              "flex items-center space-x-2", // Removed mr-6 that was for SidebarTrigger
              isCustomer ? "customer-header-text-color" : "text-[hsl(var(--header-foreground))]"
            )}
          >
            <PocketKnife className="h-6 w-6" /> {/* Always show PocketKnife */}
             <span className="font-bold sm:inline-block"> {/* Always show App Name */}
              {APP_NAME}
            </span>
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          {loading ? (
            <Skeleton className="h-10 w-10 rounded-full" />
          ) : user ? (
            <UserNav className={isCustomer ? "customer-header-text-color" : ""} />
          ) : null}
        </div>
      </div>
    </header>
  );
}

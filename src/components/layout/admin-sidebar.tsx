
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from './sidebar-nav'; // Ensure NavItem type is also exported or defined here if not
import type { NavItem } from './sidebar-nav';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { APP_NAME, ROUTES } from '@/lib/constants';
import { PocketKnife } from 'lucide-react';

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || user.role !== UserRole.ADMIN) {
    return null;
  }

  // Filter nav items for Admin role
  const adminNavItems = navItems.filter(item => {
    if (item.href === ROUTES.CONTACT) return false; // Admins typically don't need "Contact Us" in their primary nav
    if (!item.roles) return true; // Items for all roles (if any are not role-specific)
    return item.roles.includes(UserRole.ADMIN);
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={ROUTES.DASHBOARD} className="flex items-center gap-2 font-semibold">
          <PocketKnife className="h-6 w-6 text-sidebar-primary" />
          <span className="text-sidebar-foreground">{APP_NAME}</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-4">
          {adminNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  pathname === item.href ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold' : 'text-sidebar-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

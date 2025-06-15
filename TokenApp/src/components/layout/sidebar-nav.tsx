
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { UserRole } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, FilePlus2, Users, Settings, Shapes, UserCog, Store, Ticket, CreditCard, Activity, ListChecks, PieChart, Printer, Megaphone } from 'lucide-react'; // Removed ShoppingBag

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

export const navItems: NavItem[] = [
  { href: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
  { href: ROUTES.MY_TOKENS, label: 'Token Saya', icon: Ticket, roles: [UserRole.CUSTOMER] },
  // { href: ROUTES.PEMBELIAN, label: 'Pembelian', icon: ShoppingBag, roles: [UserRole.CUSTOMER] }, // Navigasi baru untuk Pembelian DIHAPUS
  { href: ROUTES.PROMOTIONS, label: 'Promotions', icon: Megaphone, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.TOKEN, label: 'Pengaturan Token', icon: Shapes, roles: [UserRole.ADMIN, UserRole.TEKNISI, UserRole.VENDOR] },
  { href: ROUTES.INPUT_TOKEN, label: 'Input Token', icon: FilePlus2, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.TRANSACTION_ANALYSIS, label: 'Analisis Transaksi', icon: PieChart, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.TRANSACTIONS, label: 'Riwayat Transaksi', icon: ListChecks, roles: [UserRole.ADMIN, UserRole.TEKNISI, UserRole.CUSTOMER] },
  { href: ROUTES.RECEIPT_TEMPLATE, label: 'Struk Template', icon: Printer, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.MANAGE_CUSTOMERS, label: 'Kelola Pelanggan', icon: Users, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.MANAGE_VENDORS, label: 'Daftar Vendor', icon: Store, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.MIDTRANS_PLAYGROUND, label: 'Midtrans Playground', icon: Activity, roles: [UserRole.ADMIN, UserRole.TEKNISI] },
  { href: ROUTES.MANAGE_USERS, label: 'Kelola Pengguna', icon: UserCog, roles: [UserRole.ADMIN] },
  { href: ROUTES.SETTINGS, label: 'Pengaturan', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });

  return (
    <SidebarMenu>
      {filteredNavItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <Link href={item.href} legacyBehavior passHref>
            <SidebarMenuButton
              className={cn(
                pathname === item.href ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                'w-full justify-start rounded-md'
              )}
              isActive={pathname === item.href}
              tooltip={{ children: item.label, className: "capitalize" }}
            >
              <item.icon className="h-5 w-5 mr-3" />
              <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}


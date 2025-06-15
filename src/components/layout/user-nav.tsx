
'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES, USER_ROLES_HIERARCHY } from '@/lib/constants';
import { LogOut, Mail, User as UserIcon, Users } from 'lucide-react'; // Removed Settings, Added Mail
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';

interface UserNavProps {
  className?: string; // Accept className prop
}

export function UserNav({ className }: UserNavProps) {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  const userRoleDisplay = USER_ROLES_HIERARCHY[user.role] || 'Pengguna';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("relative h-10 w-10 rounded-full", className)}>
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
            <p className="text-xs leading-none text-muted-foreground pt-1">Peran: {userRoleDisplay}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={ROUTES.PROFILE}>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profil</span>
            </Link>
          </DropdownMenuItem>
          {(user.role === UserRole.ADMIN || user.role === UserRole.TEKNISI) && (
            <DropdownMenuItem asChild>
              <Link href={ROUTES.MANAGE_CUSTOMERS}>
                <Users className="mr-2 h-4 w-4" />
                <span>Kelola Pelanggan</span>
              </Link>
            </DropdownMenuItem>
          )}
          {user.role === UserRole.ADMIN && (
             <DropdownMenuItem asChild>
             <Link href={ROUTES.MANAGE_USERS}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4 lucide lucide-users-cog"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="19" cy="18" r="2"/><path d="m19 14.4-.75.75M19 14.4l.75.75M19 21.6l-.75-.75M19 21.6l.75.75M16.28 15.55l-.75-.75M16.28 15.55l.75-.75M21.72 15.55l-.75.75M21.72 15.55l.75.75"/></svg>
               <span>Kelola Pengguna</span>
             </Link>
           </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={ROUTES.CONTACT}>
              <Mail className="mr-2 h-4 w-4" />
              <span>Hubungi Kami</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Keluar</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

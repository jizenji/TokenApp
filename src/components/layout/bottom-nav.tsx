
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { navItems, type NavItem } from './sidebar-nav'; // Assuming navItems and NavItem type are exported

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user.role);
  });

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t bg-[hsl(var(--bottom-nav-background))] shadow-t-md">
        <ul className="flex h-full items-center justify-around px-2">
          {filteredNavItems.map((item) => (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={item.href} legacyBehavior passHref>
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'flex flex-col items-center justify-center h-14 w-14 rounded-full p-1', // Changed to rounded-full
                        pathname === item.href
                          ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400' // Active state: orange icon, light orange bg
                          : 'text-orange-400 hover:text-orange-500 hover:bg-orange-400/10' // Inactive: orange icon, light orange hover bg
                      )}
                      aria-label={item.label}
                    >
                      <a>
                        <item.icon className="h-8 w-8" /> {/* Increased icon size */}
                        {/* Label can be shown if design allows, or kept for tooltip only */}
                        {/* <span className="text-xs mt-0.5">{item.label}</span> */}
                      </a>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="capitalize mb-1">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>
    </TooltipProvider>
  );
}

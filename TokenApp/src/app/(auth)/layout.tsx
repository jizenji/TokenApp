import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PocketKnife } from 'lucide-react'; // Placeholder for app logo
import { APP_NAME, ROUTES } from '@/lib/constants';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Link href={ROUTES.HOME} className="mr-6 flex items-center space-x-2">
            <PocketKnife className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block">
              {APP_NAME}
            </span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

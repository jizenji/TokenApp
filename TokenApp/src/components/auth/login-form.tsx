
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { ROUTES } from '@/lib/constants';
import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const formSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password tidak boleh kosong.' }),
});

export function LoginForm() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      // Redirect is handled by AuthProvider or within login function
    } catch (error) {
      // Error is handled by AuthProvider toast or within login function
    } finally {
      setIsLoading(false);
    }
  }

  const handleForgotPassword = () => {
    const adminWhatsappNumber = "6285720505555"; // Nomor WhatsApp Admin
    const message = encodeURIComponent("Halo Admin, saya lupa password akun saya. Mohon bantuannya.");
    // Buka link WhatsApp. Ini akan membuka aplikasi di HP atau WhatsApp Web di PC.
    window.open(`https://wa.me/${adminWhatsappNumber}?text=${message}`, '_blank');
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="anda@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Login
          </Button>
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <span>Lupa password?</span>
            <span className="mx-2">|</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon"
                    onClick={handleForgotPassword}
                    className="p-0 h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/50"
                    aria-label="Lupa Password? Hubungi Admin via WhatsApp"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.33 3.42 16.79L2.05 22L7.31 20.63C8.72 21.39 10.33 21.82 12.04 21.82C17.5 21.82 21.95 17.37 21.95 11.91C21.95 9.27 20.83 6.82 18.91 4.91C17 3.01 14.61 2 12.04 2M12.04 3.88C16.52 3.88 20.07 7.42 20.07 11.91C20.07 16.4 16.52 19.94 12.04 19.94C10.53 19.94 9.11 19.56 7.91 18.89L7.52 18.67L4.56 19.55L5.45 16.68L5.22 16.29C4.47 14.98 4.01 13.48 4.01 11.91C4.01 7.42 7.56 3.88 12.04 3.88M17.44 14.84C17.33 14.73 16.52 14.32 16.34 14.25C16.16 14.18 16.03 14.14 15.91 14.32C15.78 14.5 15.31 15.03 15.17 15.17C15.03 15.31 14.89 15.33 14.64 15.23C14.39 15.12 13.49 14.81 12.43 13.89C11.61 13.19 11.03 12.32 10.89 12.07C10.75 11.82 10.85 11.71 10.97 11.59C11.08 11.49 11.23 11.31 11.35 11.17C11.47 11.03 11.53 10.91 11.63 10.73C11.73 10.55 11.67 10.41 11.61 10.29C11.55 10.18 11.02 8.86 10.79 8.31C10.56 7.76 10.33 7.82 10.17 7.81C10.01 7.81 9.86 7.81 9.71 7.81C9.56 7.81 9.32 7.87 9.12 8.24C8.92 8.61 8.24 9.29 8.24 10.55C8.24 11.81 9.14 13.02 9.26 13.17C9.38 13.31 10.95 15.64 13.29 16.59C13.85 16.83 14.29 16.97 14.61 17.07C15.14 17.23 15.64 17.19 16.03 17.12C16.47 17.04 17.26 16.57 17.42 16.13C17.58 15.68 17.58 15.31 17.52 15.17C17.47 15.04 17.55 14.95 17.44 14.84Z"></path>
                    </svg>
                    <span className="sr-only">Lupa Password? Hubungi Admin via WhatsApp</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Hubungi Admin via WhatsApp</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </form>
      </Form>
    </>
  );
}

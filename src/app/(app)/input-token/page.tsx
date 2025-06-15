
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TokenForm } from '@/components/input-token/token-form';
import { ShieldCheck } from 'lucide-react';

export default function InputTokenPage() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Input Token (Administrator)</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Masukkan ID Pelanggan dan Cek halaman Transaksi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TokenForm />
        </CardContent>
      </Card>
    </div>
  );
}
    

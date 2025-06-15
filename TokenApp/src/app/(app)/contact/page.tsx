
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MapPin, User, AtSign, FileText, Loader2, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function ContactPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSendMessage = async () => {
    console.log('[ContactPage] handleSendMessage triggered.');
    if (!name || !email || !subject || !message) {
      toast({
        title: "Input Tidak Lengkap",
        description: "Harap lengkapi semua field sebelum mengirim.",
        variant: "destructive",
      });
      console.warn('[ContactPage] Form validation failed: name, email, subject, or message is empty.');
      return;
    }
    setIsSubmitting(true);
    console.log('[ContactPage] Submitting state set to true.');

    const whatsappNumber = "6285720505555";
    let textContent = `Halo,\n\nNama: ${name}\nEmail: ${email}\nSubjek: ${subject}\n\nPesan:\n${message}`;
    console.log('[ContactPage] Initial textContent:', textContent);

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        const { latitude, longitude } = position.coords;
        const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        textContent += `\n\nLokasi Pelapor:\n${locationLink}`;
        console.log('[ContactPage] Location fetched:', locationLink);
        toast({
          title: "Lokasi Terlampir",
          description: "Lokasi Anda akan disertakan dalam pesan.",
        });
      } catch (error: any) {
        console.warn('[ContactPage] Error fetching location or permission denied:', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          toast({
            title: "Akses Lokasi Ditolak",
            description: "Pesan akan dikirim tanpa informasi lokasi.",
            variant: "default",
          });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
           toast({
            title: "Lokasi Tidak Tersedia",
            description: "Tidak dapat mengambil lokasi saat ini. Pesan akan dikirim tanpa informasi lokasi.",
            variant: "default",
          });
        } else if (error.code === error.TIMEOUT) {
           toast({
            title: "Waktu Habis Mendapatkan Lokasi",
            description: "Waktu habis saat mencoba mengambil lokasi. Pesan akan dikirim tanpa informasi lokasi.",
            variant: "default",
          });
        }
        else {
          toast({
            title: "Gagal Mendapatkan Lokasi",
            description: "Terjadi kesalahan saat mengambil lokasi. Pesan akan dikirim tanpa informasi lokasi.",
            variant: "default",
          });
        }
        textContent += `\n\nLokasi Pelapor: (Tidak dapat diambil/Izin ditolak)`;
      }
    } else {
      console.warn('[ContactPage] Geolocation not supported by this browser.');
      textContent += `\n\nLokasi Pelapor: (Browser tidak mendukung geolokasi)`;
      toast({
        title: "Geolokasi Tidak Didukung",
        description: "Browser Anda tidak mendukung geolokasi. Pesan akan dikirim tanpa informasi lokasi.",
        variant: "default",
      });
    }

    const encodedMessage = encodeURIComponent(textContent);
    const whatsappUrlBase = `https://wa.me/${whatsappNumber}?text=`;
    const whatsappUrl = whatsappUrlBase + encodedMessage;
    
    const MAX_WHATSAPP_URL_LENGTH = 2000; 
    if (whatsappUrl.length > MAX_WHATSAPP_URL_LENGTH) {
        toast({
            title: "Pesan Terlalu Panjang",
            description: `Pesan Anda terlalu panjang untuk dikirim via WhatsApp (Total ${whatsappUrl.length} karakter, maks ${MAX_WHATSAPP_URL_LENGTH}). Harap perpendek pesan Anda atau hapus lampiran lokasi jika terlalu detail.`,
            variant: "destructive",
        });
        console.warn('[ContactPage] WhatsApp URL exceeds MAX_WHATSAPP_URL_LENGTH.');
        setIsSubmitting(false);
        return;
    }
    
    console.log('[ContactPage] Generated WhatsApp URL (before length check):', whatsappUrl.substring(0,200) + "...");
    console.log('[ContactPage] Total WhatsApp URL length:', whatsappUrl.length);
    
    console.log('[ContactPage] URL length check passed. Attempting to open WhatsApp URL...');
    window.open(whatsappUrl, '_blank');
    console.log('[ContactPage] window.open called.');

    setMessage('');
    setSubject('');
    console.log('[ContactPage] Form fields reset.');

    setIsSubmitting(false);
    console.log('[ContactPage] Submitting state set to false.');
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-4xl mx-auto shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Hubungi Kami</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Kami senang mendengar dari Anda! Isi formulir di bawah dan pesan Anda akan dikirim melalui WhatsApp ke Admin.
            Lokasi Anda akan diminta untuk disertakan dalam pesan jika Anda mengizinkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8 p-8">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Kirim Pesan</h3>
              <p className="text-muted-foreground">
                Lengkapi data berikut.
              </p>
            </div>
            {authLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <Label htmlFor="name" className="flex items-center"><User className="h-4 w-4 mr-2 text-muted-foreground"/>Nama Lengkap</Label>
                <Input
                  id="name"
                  value={name}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center"><AtSign className="h-4 w-4 mr-2 text-muted-foreground"/>Alamat Email</Label>
                <Input
                  type="email"
                  id="email"
                  value={email}
                  readOnly
                  className="bg-muted/50 cursor-not-allowed"
                />
              </div>
              <div>
                <Label htmlFor="subject" className="flex items-center"><FileText className="h-4 w-4 mr-2 text-muted-foreground"/>Subjek</Label>
                <Select onValueChange={setSubject} value={subject}>
                  <SelectTrigger id="subject">
                    <SelectValue placeholder="Pilih subjek" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrasi">Administrasi</SelectItem>
                    <SelectItem value="Teknisi">Teknisi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">Pesan</Label>
                <Textarea
                  id="message"
                  placeholder="Tuliskan pesan Anda di sini..."
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <Globe className="h-3 w-3 mr-1.5 text-muted-foreground" />
                Saat mengirim, browser mungkin akan meminta izin untuk mengakses lokasi Anda.
              </p>
              <Button
                type="button"
                className="w-full"
                onClick={handleSendMessage}
                disabled={isSubmitting || authLoading || !name || !email || !subject || !message}
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Kirim Pesan via WhatsApp
              </Button>
              <p className="text-xs text-center text-muted-foreground">Pesan Anda akan dikirim melalui WhatsApp ke nomor Admin.</p>
            </form>
            )}
          </div>
          <div className="space-y-6 rounded-lg bg-secondary p-6">
             <div>
              <h3 className="text-xl font-semibold mb-4">Informasi Kontak</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-sm">Jl. Token No. 123, Kota Data, ID 54321</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-sm">+62 123 456 7890</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="text-sm">support@datatokenapp.com</span>
                </div>
              </div>
            </div>
            <div>
                <h3 className="text-xl font-semibold mb-2">Jam Kantor</h3>
                <p className="text-sm text-muted-foreground">Senin - Jumat: 09:00 - 17:00</p>
                <p className="text-sm text-muted-foreground">Sabtu - Minggu: Tutup</p>
            </div>
            <div>
              <iframe
                title="Peta Lokasi Kantor"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1179.1301555175162!2d106.98318878899407!3d-6.249855706435129!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e698c3669bb7bc5%3A0x553935395094b20e!2sMall%20Grand%20Metropolitan%20Bekasi!5e0!3m2!1sid!2sid!4v1749160509516!5m2!1sid!2sid"
                className="w-full h-48 rounded-md border-0"
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              ></iframe>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


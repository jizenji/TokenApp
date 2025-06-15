
'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Printer, Save, Loader2, UploadCloud, X, Eye as PreviewIcon } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import type { ReceiptTemplateSettings, GeneratedToken } from '@/types';
import Image from 'next/image';
import { printTransactionReceipt } from '@/lib/printUtils';

const initialSettings: ReceiptTemplateSettings = {
  shopName: 'PT. XYZ SAITEC',
  shopAddress: 'Jl. Merdeka No. 123, Kota Technopolis',
  shopPhone: 'Telp: 021-555-1234',
  shopWebsite: '',
  logoUrl: '',
  thankYouMessage: 'Terimakasih Telah Bertransaksi!',
  footerNote1: 'Simpan struk ini sebagai bukti pembayaran.',
  footerNote2: '',
};

const MAX_LOGO_SIZE_MB = 1;
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/gif'];

export default function ReceiptTemplatePage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ReceiptTemplateSettings>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isFetchingSampleTx, setIsFetchingSampleTx] = useState(false);

  const settingsDocRef = doc(db, 'appConfiguration', 'receiptTemplateSettings');

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          const fetchedSettings = { ...initialSettings, ...docSnap.data() } as ReceiptTemplateSettings;
          setSettings(fetchedSettings);
          setLogoPreview(fetchedSettings.logoUrl || null);
        } else {
          await setDoc(settingsDocRef, initialSettings);
          setSettings(initialSettings);
          setLogoPreview(initialSettings.logoUrl || null);
        }
      } catch (error) {
        console.error("Error fetching receipt template settings:", error);
        toast({
          title: "Error Memuat Pengaturan",
          description: "Gagal memuat pengaturan template struk.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [toast]); // settingsDocRef dihapus dari dependensi

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
        toast({ title: "Logo Terlalu Besar", description: `Ukuran logo maksimal ${MAX_LOGO_SIZE_MB}MB.`, variant: "destructive" });
        return;
      }
      if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        toast({ title: "Format Logo Salah", description: `Hanya ${ALLOWED_LOGO_TYPES.join(', ')} yang didukung.`, variant: "destructive" });
        return;
      }
      setSelectedLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setSelectedLogoFile(null);
    setLogoPreview(null); // This indicates user wants to remove the logo
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    let finalLogoUrl = settings.logoUrl;

    if (selectedLogoFile && logoPreview) { // New logo uploaded and preview is ready
      finalLogoUrl = logoPreview; // logoPreview holds the Data URI
    } else if (logoPreview === null && settings.logoUrl !== null && settings.logoUrl !== '') { // Logo was explicitly removed by user
      finalLogoUrl = ''; 
    }
    // If no new file and logoPreview matches settings.logoUrl, finalLogoUrl remains as settings.logoUrl (no change)

    const settingsToSave = { ...settings, logoUrl: finalLogoUrl };

    try {
      await setDoc(settingsDocRef, settingsToSave, { merge: true });
      setSettings(settingsToSave); // Update local state to reflect saved state, including potentially cleared logo
      toast({
        title: "Pengaturan Disimpan",
        description: "Template struk berhasil diperbarui.",
      });
    } catch (error) {
      console.error("Error saving receipt template settings:", error);
      toast({
        title: "Gagal Menyimpan",
        description: "Tidak dapat menyimpan perubahan template struk.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewReceipt = async () => {
    setIsFetchingSampleTx(true);
    try {
      const tokensQuery = query(collection(db, 'generated_tokens'), orderBy('createdAt', 'desc'), limit(1));
      const querySnapshot = await getDocs(tokensQuery);
      if (querySnapshot.empty) {
        toast({ title: "Tidak Ada Transaksi", description: "Tidak ada data transaksi untuk preview.", variant: "default" });
        return;
      }
      const sampleTxDoc = querySnapshot.docs[0];
      const sampleTx = {
        ...sampleTxDoc.data(),
        id: sampleTxDoc.id,
        createdAt: (sampleTxDoc.data().createdAt as Timestamp).toDate(),
      } as GeneratedToken;

      const currentFormSettings: ReceiptTemplateSettings = {
        ...settings, // Values from input fields
        logoUrl: logoPreview || undefined, // Use the current preview URL
      };
      
      printTransactionReceipt(sampleTx, toast, currentFormSettings);

    } catch (error) {
      console.error("Error fetching sample transaction for preview:", error);
      toast({ title: "Error Preview", description: "Gagal mengambil data transaksi contoh.", variant: "destructive" });
    } finally {
      setIsFetchingSampleTx(false);
    }
  };


  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-0 flex justify-center items-center h-[calc(100vh-150px)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0">
      <Card className="max-w-3xl mx-auto shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <Printer className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Pengaturan Template Struk</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Sesuaikan tampilan struk transaksi yang akan dicetak.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="shopName">Nama Toko/Perusahaan</Label>
            <Input id="shopName" name="shopName" value={settings.shopName} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopAddress">Alamat</Label>
            <Textarea id="shopAddress" name="shopAddress" value={settings.shopAddress} onChange={handleInputChange} rows={2}/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopPhone">Nomor Telepon</Label>
            <Input id="shopPhone" name="shopPhone" value={settings.shopPhone} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopWebsite">Website (Opsional)</Label>
            <Input id="shopWebsite" name="shopWebsite" value={settings.shopWebsite || ''} onChange={handleInputChange} placeholder="https://www.example.com"/>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="logoFile">Logo Toko (Opsional, maks {MAX_LOGO_SIZE_MB}MB)</Label>
            <Input
              id="logoFile"
              name="logoFile"
              type="file"
              accept={ALLOWED_LOGO_TYPES.join(',')}
              onChange={handleLogoChange}
              ref={logoInputRef}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {logoPreview && (
              <div className="mt-2 relative w-32 h-32 border p-1 rounded bg-muted/30">
                <Image src={logoPreview} alt="Logo Preview" layout="fill" objectFit="contain" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/80 p-0.5"
                  onClick={handleRemoveLogo}
                  aria-label="Remove logo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Format: PNG, JPG, SVG, GIF. Gambar akan diubah menjadi Data URI untuk disimpan.</p>
          </div>

          <hr className="my-6"/>

          <div className="space-y-2">
            <Label htmlFor="thankYouMessage">Pesan Terima Kasih (Footer)</Label>
            <Input id="thankYouMessage" name="thankYouMessage" value={settings.thankYouMessage} onChange={handleInputChange} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footerNote1">Catatan Kaki 1 (Opsional)</Label>
            <Input id="footerNote1" name="footerNote1" value={settings.footerNote1 || ''} onChange={handleInputChange} placeholder="Contoh: Simpan struk ini sebagai bukti..."/>
          </div>
           <div className="space-y-2">
            <Label htmlFor="footerNote2">Catatan Kaki 2 (Opsional)</Label>
            <Input id="footerNote2" name="footerNote2" value={settings.footerNote2 || ''} onChange={handleInputChange} placeholder="Contoh: Info Kontak CS"/>
          </div>
        </CardContent>
        <CardFooter className="border-t pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <Button onClick={handlePreviewReceipt} variant="outline" disabled={isFetchingSampleTx || isSaving} className="w-full sm:w-auto">
            {isFetchingSampleTx ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PreviewIcon className="mr-2 h-4 w-4" />}
            Preview Struk
          </Button>
          <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Simpan Pengaturan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

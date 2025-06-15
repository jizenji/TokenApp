
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // Added useCallback and useRef
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, PlusCircle, Edit3, Trash2, Loader2, ExternalLink, Image as ImageIcon, TicketPercent } from 'lucide-react';
import { db } from '@/config/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { PromotionData } from '@/types';
import NextImage from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';


const initialPromotionFormState: Omit<PromotionData, 'id' | 'createdAt'> = {
  imageUrl: '',
  altText: '',
  linkUrl: '',
  isActive: true,
  displayOrder: 0,
  relatedVoucherCode: '',
};

export default function PromotionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [promotions, setPromotions] = useState<PromotionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPromotion, setCurrentPromotion] = useState<PromotionData | null>(null);
  const [formData, setFormData] = useState(initialPromotionFormState);
  const [promotionToDelete, setPromotionToDelete] = useState<PromotionData | null>(null);

  const promotionsCollectionRef = useMemo(() => collection(db, 'promotions'), []);

  useEffect(() => {
    const fetchPromotions = async () => {
      setIsLoading(true);
      try {
        const q = query(
          promotionsCollectionRef,
          where('isActive', 'in', [true, false]),
          orderBy('displayOrder', 'asc'),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const fetchedPromotions = querySnapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate() : new Date(),
          } as PromotionData;
        });
        setPromotions(fetchedPromotions);
      } catch (error) {
        console.error("Error fetching promotions:", error);
        toast({ title: 'Error Memuat Promosi', description: (error as Error).message, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPromotions();
  }, [promotionsCollectionRef, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value, 10) || 0 : value),
    }));
  };

  const handleOpenAddDialog = () => {
    setCurrentPromotion(null);
    setFormData(initialPromotionFormState);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (promo: PromotionData) => {
    setCurrentPromotion(promo);
    setFormData({
      imageUrl: promo.imageUrl,
      altText: promo.altText,
      linkUrl: promo.linkUrl || '',
      isActive: promo.isActive,
      displayOrder: promo.displayOrder || 0,
      relatedVoucherCode: promo.relatedVoucherCode || '',
    });
    setIsDialogOpen(true);
  };

  const handleSavePromotion = async () => {
    if (!formData.imageUrl.trim() || !formData.altText.trim()) {
      toast({ title: 'Validasi Gagal', description: 'URL Gambar dan Teks Alternatif wajib diisi.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const dataToSave = {
        ...formData,
        linkUrl: formData.linkUrl?.trim() === '' ? null : formData.linkUrl?.trim(),
        relatedVoucherCode: formData.relatedVoucherCode?.trim() === '' ? '' : formData.relatedVoucherCode?.trim().toUpperCase(),
        updatedAt: serverTimestamp(),
      };

      if (currentPromotion && currentPromotion.id) {
        await updateDoc(doc(db, 'promotions', currentPromotion.id), dataToSave);
        setPromotions(prev => prev.map(p => p.id === currentPromotion.id ? { ...p, ...dataToSave, updatedAt: new Date() } : p)
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || (a.createdAt.getTime() - b.createdAt.getTime()))
        );
        toast({ title: 'Promosi Diperbarui', description: `Promosi "${formData.altText}" berhasil diperbarui.` });
      } else {
        const docRef = await addDoc(promotionsCollectionRef, { ...dataToSave, createdAt: serverTimestamp() });
        setPromotions(prev => [...prev, { ...dataToSave, id: docRef.id, createdAt: new Date(), updatedAt: new Date() }]
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || (a.createdAt.getTime() - b.createdAt.getTime()))
        );
        toast({ title: 'Promosi Ditambahkan', description: `Promosi "${formData.altText}" berhasil ditambahkan.` });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error saving promotion:", error);
      toast({ title: 'Gagal Menyimpan', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeletePromotion = async () => {
    if (!promotionToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'promotions', promotionToDelete.id));
      setPromotions(prev => prev.filter(p => p.id !== promotionToDelete.id));
      toast({ title: 'Promosi Dihapus', description: `Promosi "${promotionToDelete.altText}" berhasil dihapus.` });
    } catch (error) {
      console.error("Error deleting promotion:", error);
      toast({ title: 'Gagal Menghapus', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setPromotionToDelete(null);
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (promo: PromotionData) => {
    setIsSubmitting(true);
    try {
      const newStatus = !promo.isActive;
      await updateDoc(doc(db, 'promotions', promo.id), { isActive: newStatus, updatedAt: serverTimestamp() });
      setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, isActive: newStatus, updatedAt: new Date() } : p));
      toast({ title: 'Status Diperbarui', description: `Promosi "${promo.altText}" sekarang ${newStatus ? 'Aktif' : 'Tidak Aktif'}.` });
    } catch (error) {
      console.error("Error toggling active status:", error);
      toast({ title: 'Gagal Update Status', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || (user.role !== UserRole.ADMIN && user.role !== UserRole.TEKNISI)) {
    return (
      <Card className="shadow-xl m-4">
        <CardHeader><CardTitle>Akses Ditolak</CardTitle></CardHeader>
        <CardContent><p>Anda tidak memiliki izin untuk melihat halaman ini.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <Megaphone className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl font-bold tracking-tight">Kelola Promosi</CardTitle>
            </div>
            <CardDescription className="text-lg text-muted-foreground">
              Atur konten promosi yang ditampilkan di dashboard pelanggan.
            </CardDescription>
          </div>
          <Button className="mt-4 md:mt-0" onClick={handleOpenAddDialog}>
            <PlusCircle className="mr-2 h-5 w-5" /> Tambah Promosi Baru
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Memuat promosi...</p>
            </div>
          ) : promotions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Belum ada promosi. Klik "Tambah Promosi Baru" untuk memulai.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Gambar</TableHead>
                    <TableHead>Teks Alternatif/Judul</TableHead>
                    <TableHead>URL Tautan</TableHead>
                    <TableHead>Kode Voucher</TableHead>
                    <TableHead className="text-center">Urutan</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[180px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell>
                      <div className="relative h-12 w-20 rounded overflow-hidden bg-muted">
                        {promo.imageUrl ? (
                          <NextImage
                            src={promo.imageUrl}
                            alt={promo.altText.substring(0, 30)}
                            fill
                            sizes="80px"
                            className="object-cover"
                            data-ai-hint="thumbnail advertisement"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{promo.altText}</TableCell>
                    <TableCell>
                      {promo.linkUrl ? (
                        <Link href={promo.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center text-sm">
                          {promo.linkUrl.length > 30 ? `${promo.linkUrl.substring(0,30)}...` : promo.linkUrl} <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {promo.relatedVoucherCode ? (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{promo.relatedVoucherCode}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{promo.displayOrder ?? '-'}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={promo.isActive}
                        onCheckedChange={() => handleToggleActive(promo)}
                        disabled={isSubmitting}
                        aria-label={`Toggle status promosi ${promo.altText}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="icon" aria-label={`Edit promosi ${promo.altText}`} onClick={() => handleOpenEditDialog(promo)} disabled={isSubmitting}>
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="icon" aria-label={`Hapus promosi ${promo.altText}`} onClick={() => setPromotionToDelete(promo)} disabled={isSubmitting}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { if (!isSubmitting) setIsDialogOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentPromotion ? 'Edit Promosi' : 'Tambah Promosi Baru'}</DialogTitle>
            <DialogDescription>
              {currentPromotion ? 'Perbarui detail promosi ini.' : 'Masukkan detail untuk promosi baru.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="imageUrl">URL Gambar*</Label>
              <Input id="imageUrl" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://example.com/image.png" />
              <p className="text-xs text-muted-foreground mt-1">Masukkan URL lengkap gambar promosi. Unggahan file belum didukung.</p>
            </div>
            <div>
              <Label htmlFor="altText">Teks Alternatif/Judul*</Label>
              <Input id="altText" name="altText" value={formData.altText} onChange={handleInputChange} placeholder="Contoh: Diskon Spesial Akhir Tahun!" />
            </div>
            <div>
              <Label htmlFor="linkUrl">URL Tautan (Opsional)</Label>
              <Input id="linkUrl" name="linkUrl" value={formData.linkUrl} onChange={handleInputChange} placeholder="https://tokopedia.com/promo-anda" />
            </div>
            <div>
              <Label htmlFor="relatedVoucherCode">Kode Voucher Terkait (Opsional)</Label>
              <div className="flex items-center space-x-2">
                <TicketPercent className="h-5 w-5 text-muted-foreground" />
                <Input
                  id="relatedVoucherCode"
                  name="relatedVoucherCode"
                  value={formData.relatedVoucherCode || ''}
                  onChange={handleInputChange}
                  placeholder="Contoh: DISKON10K"
                  className="flex-grow"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Jika promosi ini terkait dengan kode voucher tertentu.</p>
            </div>
            <div>
              <Label htmlFor="displayOrder">Urutan Tampilan</Label>
              <Input id="displayOrder" name="displayOrder" type="number" value={formData.displayOrder || 0} onChange={handleInputChange} placeholder="0" />
              <p className="text-xs text-muted-foreground mt-1">Angka lebih kecil tampil lebih dulu.</p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="isActive" name="isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData(prev => ({...prev, isActive: checked}))} />
              <Label htmlFor="isActive">Aktifkan Promosi</Label>
            </div>
          </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting}>Batal</Button>
            </DialogClose>
            <Button onClick={handleSavePromotion} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentPromotion ? 'Simpan Perubahan' : 'Tambah Promosi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {promotionToDelete && (
        <AlertDialog open={!!promotionToDelete} onOpenChange={(open) => !open && setPromotionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anda Yakin?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus promosi &quot;{promotionToDelete.altText}&quot; secara permanen.
                Data yang dihapus tidak dapat dikembalikan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPromotionToDelete(null)} disabled={isSubmitting}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePromotion} className="bg-destructive hover:bg-destructive/90" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

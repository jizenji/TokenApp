
'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListChecks, Loader2, ArrowLeft, ArrowRight, Copy, Info, Trash2, Printer, CheckCircle2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs, Timestamp, limit, startAfter, endBefore, limitToLast, DocumentData, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { GeneratedToken } from '@/types';
import { cn } from '@/lib/utils';
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
  AlertDialogTitle as AlertDialogRadixTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { printTransactionReceipt } from '@/lib/printUtils'; 
import { Badge } from '@/components/ui/badge';

const ITEMS_PER_PAGE = 15;

const tokenTypeDisplayMapSimpleLocal: Record<string, string> = {
  electricity: 'Listrik',
  water: 'Air',
  gas: 'Gas',
  solar: 'Solar',
  unknown: 'Tidak Diketahui',
};

const tokenTypeUnitMapLocal: Record<string, string> = {
  ELECTRICITY: 'KWh',
  WATER: 'm³',
  GAS: 'm³',
  SOLAR: 'kWp',
  UNKNOWN: 'Unit',
  DEFAULT: 'Unit',
};

export default function TransactionsPage() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<GeneratedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<DocumentData | null>(null);
  const [firstVisibleDoc, setFirstVisibleDoc] = useState<DocumentData | null>(null);
  const [isFetchingPage, setIsFetchingPage] = useState(false);
  const [hasMoreNext, setHasMoreNext] = useState(true);

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedTransactionForDetail, setSelectedTransactionForDetail] = useState<GeneratedToken | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<GeneratedToken | null>(null);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);

  const fetchTransactionsData = useCallback(async (direction: 'next' | 'prev' | 'first' = 'first') => {
    setIsFetchingPage(true);
    if (direction === 'first') {
      setLastVisibleDoc(null);
      setFirstVisibleDoc(null);
      setCurrentPage(1);
    }

    try {
      const tokensCollectionRef = collection(db, 'generated_tokens');
      let q;
      const baseQueryConstraints = [orderBy('createdAt', 'desc')];

      if (direction === 'first') {
        q = query(tokensCollectionRef, ...baseQueryConstraints, limit(ITEMS_PER_PAGE));
      } else if (direction === 'next' && lastVisibleDoc) {
        q = query(tokensCollectionRef, ...baseQueryConstraints, startAfter(lastVisibleDoc), limit(ITEMS_PER_PAGE));
      } else if (direction === 'prev' && firstVisibleDoc) {
        q = query(tokensCollectionRef, ...baseQueryConstraints, endBefore(firstVisibleDoc), limitToLast(ITEMS_PER_PAGE));
      } else {
        q = query(tokensCollectionRef, ...baseQueryConstraints, limit(ITEMS_PER_PAGE));
      }

      const querySnapshot = await getDocs(q);
      const fetchedTransactions = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();

        let createdAtDate: Date;
        if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
          createdAtDate = (data.createdAt as Timestamp).toDate();
        } else if (data.createdAt && (typeof data.createdAt === 'string' || typeof data.createdAt === 'number')) {
          const parsedDate = new Date(data.createdAt);
          createdAtDate = isNaN(parsedDate.getTime()) ? new Date(0) : parsedDate;
        } else if (data.createdAt instanceof Date) {
          createdAtDate = data.createdAt;
        } else {
          createdAtDate = new Date(0);
        }

        let numericAmount: number;
        if (typeof data.amount === 'number') {
          numericAmount = data.amount;
        } else if (typeof data.amount === 'string') {
          const cleanedString = String(data.amount).replace(/\D/g, '');
          const parsed = parseInt(cleanedString, 10);
          numericAmount = isNaN(parsed) ? 0 : parsed;
        } else {
          numericAmount = 0;
        }
        
        let numericActualTotalPayment: number;
         if (typeof data.actualTotalPayment === 'number') {
          numericActualTotalPayment = data.actualTotalPayment;
        } else if (typeof data.actualTotalPayment === 'string') {
          const cleanedString = String(data.actualTotalPayment).replace(/\D/g, '');
          const parsed = parseInt(cleanedString, 10);
          numericActualTotalPayment = isNaN(parsed) ? 0 : parsed;
        } else {
          numericActualTotalPayment = data.amount; // Fallback if not present
        }


        return {
          id: docSnap.id,
          orderId: String(data.orderId || '-'),
          customerId: String(data.customerId || '-'),
          customerName: String(data.customerName || data.customerId || '-'),
          serviceId: String(data.serviceId || '-'),
          type: String(data.type || 'unknown').toLowerCase(),
          amount: numericAmount, // Nominal Token
          generatedTokenCode: String(data.generatedTokenCode || '-'),
          createdAt: createdAtDate,
          basePrice: typeof data.basePrice === 'number' ? data.basePrice : undefined,
          unitValue: typeof data.unitValue === 'string' ? data.unitValue : (typeof data.unitValue === 'number' ? String(data.unitValue) : undefined),
          // Purchase summary fields
          adminFee: typeof data.adminFee === 'number' ? data.adminFee : 0,
          taxAmount: typeof data.taxAmount === 'number' ? data.taxAmount : 0,
          otherCosts: typeof data.otherCosts === 'number' ? data.otherCosts : 0,
          discountAmount: typeof data.discountAmount === 'number' ? data.discountAmount : 0,
          voucherCodeUsed: data.voucherCodeUsed || null,
          originalTotalBeforeDiscount: typeof data.originalTotalBeforeDiscount === 'number' ? data.originalTotalBeforeDiscount : (numericAmount + (data.adminFee || 0) + (data.taxAmount || 0) + (data.otherCosts || 0)),
          actualTotalPayment: numericActualTotalPayment,
        } as GeneratedToken;
      });

      setTransactions(fetchedTransactions);

      if (querySnapshot.docs.length > 0) {
        setFirstVisibleDoc(querySnapshot.docs[0]);
        setLastVisibleDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setHasMoreNext(fetchedTransactions.length === ITEMS_PER_PAGE);
      } else {
        setHasMoreNext(false);
        if (direction === 'first') {
           setFirstVisibleDoc(null);
           setLastVisibleDoc(null);
        }
      }
      setError(null);
    } catch (err: any) {
      console.error("Error fetching transactions:", err, err.stack);
      setError("Gagal memuat data transaksi. Silakan coba lagi nanti.");
      toast({ title: "Error Pengambilan Data", description: err.message || "Terjadi kesalahan saat mengambil data transaksi.", variant: "destructive" });
      setTransactions([]);
      setHasMoreNext(false);
    } finally {
      setIsFetchingPage(false);
      if (isLoading && direction === 'first') {
        setIsLoading(false);
      }
    }
  }, [lastVisibleDoc, firstVisibleDoc, toast, isLoading]);

  useEffect(() => {
    if (isLoading) {
        fetchTransactionsData('first');
    }
  }, [fetchTransactionsData, isLoading]);

  const handleNextPage = () => {
    if (hasMoreNext && !isFetchingPage) {
      setCurrentPage(prev => prev + 1);
      fetchTransactionsData('next');
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1 && !isFetchingPage) {
      setCurrentPage(prev => prev - 1);
      fetchTransactionsData('prev');
    }
  };

  const copyToClipboard = (text: string, type: string = "Kode Token") => {
    if (text === null || text === undefined || text === '-') {
      toast({ title: "Gagal Menyalin", description: `${type} tidak valid atau kosong.`, variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Berhasil Disalin", description: `${type} "${text}" telah disalin.` }))
      .catch(() => toast({ title: "Gagal Menyalin", description: `Tidak dapat menyalin ${type}.`, variant: "destructive" }));
  };

  const formatUnitValueForDisplayLocal = (unitValueStr: string | undefined, itemType: string): string => {
    if (!unitValueStr || unitValueStr.trim() === '') return 'N/A';
    const knownUnitsShort = Object.values(tokenTypeUnitMapLocal).map(u => u.toLowerCase());
    const lowerUnitValueStr = unitValueStr.toLowerCase();

    let unitAlreadyPresent = false;
    for (const unit of knownUnitsShort) {
        const regex = new RegExp(`\\d([.,]\\d+)?\\s*${unit.replace('³', '³?')}$`);
        if (regex.test(lowerUnitValueStr)) {
            unitAlreadyPresent = true;
            break;
        }
    }

    if (unitAlreadyPresent) return unitValueStr;
    const unitToAdd = tokenTypeUnitMapLocal[itemType.toUpperCase() as keyof typeof tokenTypeUnitMapLocal] || tokenTypeUnitMapLocal.DEFAULT;
    return `${unitValueStr} ${unitToAdd}`;
  };

  const openDetailDialog = (transaction: GeneratedToken) => {
    setSelectedTransactionForDetail(transaction);
    setIsDetailDialogOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) return;
    setIsDeletingTransaction(true);
    try {
      await deleteDoc(doc(db, 'generated_tokens', transactionToDelete.id));
      toast({ title: "Transaksi Dihapus", description: `Transaksi dengan ID Order ${transactionToDelete.orderId} telah berhasil dihapus.` });
      setTransactionToDelete(null);
      setIsDetailDialogOpen(false);
      fetchTransactionsData('first');
    } catch (err: any) {
      console.error("Error deleting transaction:", err);
      toast({ title: "Gagal Menghapus", description: err.message || "Tidak dapat menghapus transaksi.", variant: "destructive" });
    } finally {
      setIsDeletingTransaction(false);
    }
  };

  const handlePrintReceipt = () => {
    printTransactionReceipt(selectedTransactionForDetail, toast);
  };


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <ListChecks className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Riwayat Transaksi</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Daftar semua transaksi token yang telah tercatat dalam sistem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
             <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Memuat data transaksi...</p>
            </div>
          ) : error ? (
            <div className="text-destructive text-center py-8">{error}</div>
          ) : (
            <>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tanggal</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">ID Order</TableHead>
                        <TableHead className="text-xs">Nama Pelanggan</TableHead>
                        <TableHead className="text-xs text-center">Jenis Token</TableHead>
                        <TableHead className="text-xs text-center">Nominal (Rp)</TableHead>
                        <TableHead className="text-xs text-center">Value</TableHead>
                        <TableHead className="text-xs">Kode Token</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((item) => (
                        <TableRow
                          key={item.id}
                          onClick={() => openDetailDialog(item)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="text-xs">{item.createdAt instanceof Date && !isNaN(item.createdAt.getTime()) ? item.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Invalid Date'}</TableCell>
                          <TableCell>
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Sukses
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{item.orderId}</TableCell>
                          <TableCell className="text-xs">{item.customerName || '-'}</TableCell>
                          <TableCell className="text-xs text-center">{(tokenTypeDisplayMapSimpleLocal[item.type] || tokenTypeDisplayMapSimpleLocal.unknown)}</TableCell>
                          <TableCell className="text-xs text-center">{typeof item.amount === 'number' ? item.amount.toLocaleString('id-ID') : '-'}</TableCell>
                          <TableCell className="text-xs text-center">
                            {formatUnitValueForDisplayLocal(item.unitValue, item.type)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <span className="font-mono">{item.generatedTokenCode}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(item.generatedTokenCode, "Kode Token");
                                }}
                                disabled={item.generatedTokenCode === '-'}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Tidak ada data transaksi ditemukan.
                </p>
              )}

              {(currentPage > 1 || hasMoreNext) && transactions.length > 0 && (
                <div className="flex items-center justify-between mt-6 gap-2 flex-wrap">
                  <Button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || isFetchingPage}
                    variant="outline"
                    size="sm"
                  >
                    <ArrowLeft className="mr-1 h-4 w-4"/> Sebelumnya
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Halaman {currentPage}
                  </span>
                  <Button
                    onClick={handleNextPage}
                    disabled={!hasMoreNext || isFetchingPage}
                    variant="outline"
                    size="sm"
                  >
                    Berikutnya <ArrowRight className="ml-1 h-4 w-4"/>
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedTransactionForDetail && (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="sm:max-w-sm transaction-detail-dialog-content">
             <DialogHeader>
              <DialogTitle>Detail Transaksi</DialogTitle>
              <DialogDescription>
                Rincian untuk ID Order: {selectedTransactionForDetail.orderId}
              </DialogDescription>
            </DialogHeader>

            <div id="printable-receipt-area" className="hidden">
            </div>

            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-2 py-2 text-sm">
                  <div><span className="font-medium text-muted-foreground">Tanggal:</span> {selectedTransactionForDetail.createdAt.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</div>
                  <div><span className="font-medium text-muted-foreground">Status:</span> <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle2 className="mr-1 h-3 w-3" />Sukses</Badge></div>
                  <div><span className="font-medium text-muted-foreground">ID Order:</span> {selectedTransactionForDetail.orderId}</div>
                  <div><span className="font-medium text-muted-foreground">Nama Pelanggan:</span> {selectedTransactionForDetail.customerName || '-'}</div>
                  <div><span className="font-medium text-muted-foreground">ID Pelanggan:</span> {selectedTransactionForDetail.customerId}</div>
                  <div><span className="font-medium text-muted-foreground">ID Layanan:</span> {selectedTransactionForDetail.serviceId}</div>
                  <div><span className="font-medium text-muted-foreground">Jenis Token:</span> {(tokenTypeDisplayMapSimpleLocal[selectedTransactionForDetail.type] || tokenTypeDisplayMapSimpleLocal.unknown)}</div>
                  
                  <hr className="my-2 border-border/70"/>
                  <p className="font-semibold text-primary text-base">Ringkasan Pembelian:</p>
                  <div className="grid grid-cols-2 gap-x-2">
                    <span className="text-muted-foreground">Nominal Token:</span><span className="text-right">Rp {selectedTransactionForDetail.amount.toLocaleString('id-ID')}</span>
                    <span className="text-muted-foreground">Biaya Admin:</span><span className="text-right">Rp {(selectedTransactionForDetail.adminFee || 0).toLocaleString('id-ID')}</span>
                    {selectedTransactionForDetail.otherCosts && selectedTransactionForDetail.otherCosts > 0 ? (<><span className="text-muted-foreground">Biaya Lain:</span><span className="text-right">Rp {selectedTransactionForDetail.otherCosts.toLocaleString('id-ID')}</span></>) : null}
                    {selectedTransactionForDetail.taxAmount && selectedTransactionForDetail.taxAmount > 0 ? (<><span className="text-muted-foreground">Pajak:</span><span className="text-right">Rp {selectedTransactionForDetail.taxAmount.toLocaleString('id-ID')}</span></>) : null}
                    {selectedTransactionForDetail.discountAmount && selectedTransactionForDetail.discountAmount > 0 ? (
                      <>
                        <span className="text-muted-foreground text-green-600 dark:text-green-400">Diskon{selectedTransactionForDetail.voucherCodeUsed ? ` (${selectedTransactionForDetail.voucherCodeUsed})` : ''}:</span>
                        <span className="text-right text-green-600 dark:text-green-400">- Rp {selectedTransactionForDetail.discountAmount.toLocaleString('id-ID')}</span>
                      </>
                    ) : null}
                     {selectedTransactionForDetail.originalTotalBeforeDiscount && selectedTransactionForDetail.discountAmount && selectedTransactionForDetail.discountAmount > 0 && (
                      <>
                        <span className="text-muted-foreground line-through text-xs col-span-1">Subtotal Awal:</span>
                        <span className="text-right text-muted-foreground line-through text-xs col-span-1">Rp {selectedTransactionForDetail.originalTotalBeforeDiscount.toLocaleString('id-ID')}</span>
                      </>
                    )}
                  </div>
                  <hr className="my-1 border-border/50"/>
                  <div className="grid grid-cols-2 gap-x-2 font-bold text-base">
                    <span className="text-primary">Total Pembayaran:</span><span className="text-right text-primary">Rp {selectedTransactionForDetail.actualTotalPayment.toLocaleString('id-ID')}</span>
                  </div>
                  <hr className="my-2 border-border/70"/>
                  
                  {selectedTransactionForDetail.unitValue && <div><span className="font-medium text-muted-foreground">Value Token:</span> {formatUnitValueForDisplayLocal(selectedTransactionForDetail.unitValue, selectedTransactionForDetail.type)}</div>}
                  {selectedTransactionForDetail.basePrice && <div><span className="font-medium text-muted-foreground">Base Price (Rp):</span> {selectedTransactionForDetail.basePrice.toLocaleString('id-ID')}</div>}
                  
                  <div className="pt-2">
                      <span className="font-medium text-primary text-base">Kode Token:</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="font-mono text-lg bg-muted px-3 py-1.5 rounded-md select-all">{selectedTransactionForDetail.generatedTokenCode}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(selectedTransactionForDetail.generatedTokenCode, "Kode Token")} disabled={selectedTransactionForDetail.generatedTokenCode === '-'}>
                            <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 flex-col sm:flex-row gap-2 dialog-footer-print-hide">
                <Button variant="outline" onClick={handlePrintReceipt} className="w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button variant="destructive" onClick={() => setTransactionToDelete(selectedTransactionForDetail)} className="w-full sm:w-auto" disabled={isDeletingTransaction}>
                    {isDeletingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="mr-2 h-4 w-4" /> Hapus
                </Button>
                <DialogClose asChild>
                    <Button variant="outline" className="w-full sm:w-auto">Tutup</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {transactionToDelete && (
        <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
          <AlertDialogHeader>
            <AlertDialogRadixTitle>Konfirmasi Hapus Transaksi</AlertDialogRadixTitle>
            <AlertDialogDescription>
              Anda yakin ingin menghapus transaksi dengan ID Order &quot;{transactionToDelete.orderId}&quot; (Kode Token: {transactionToDelete.generatedTokenCode})? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)} disabled={isDeletingTransaction}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTransaction} className="bg-destructive hover:bg-destructive/90" disabled={isDeletingTransaction}>
              {isDeletingTransaction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialog>
      )}

    </div>
  );
}

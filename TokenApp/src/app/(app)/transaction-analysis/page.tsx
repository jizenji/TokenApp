
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Explicit React import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, TrendingUp, PieChart as PieChartIcon, Activity, Package as PackageIcon, Zap, Droplet, Flame, Sun, Filter as FilterIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { DateRange } from 'react-day-picker';
// import { DatePickerWithRange } from "@/components/ui/date-range-picker"; // Tetap dikomentari
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input'; // Untuk filter jika diperlukan nanti
import { db } from '@/config/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { GeneratedToken } from '@/types';

interface TransactionSummary {
  totalTransactions: number;
  totalAmount: number;
  averageAmount: number;
  uniqueCustomers: number;
}

interface TokenTypeSummaryItem {
  count: number;
  totalAmount: number;
}

const tokenTypeDisplayMap: Record<string, {name: string, icon: React.ElementType, colorClass: string}> = {
  all: { name: 'Semua Jenis', icon: FilterIcon, colorClass: 'text-muted-foreground' },
  electricity: { name: 'Listrik', icon: Zap, colorClass: 'text-yellow-500 dark:text-yellow-400' },
  water: { name: 'Air', icon: Droplet, colorClass: 'text-blue-500 dark:text-blue-400' },
  gas: { name: 'Gas', icon: Flame, colorClass: 'text-red-500 dark:text-red-400' },
  solar: { name: 'Solar', icon: Sun, colorClass: 'text-orange-500 dark:text-orange-400' },
  unknown: { name: 'Tidak Diketahui', icon: PackageIcon, colorClass: 'text-muted-foreground' },
};


export default function TransactionAnalysisPage() {
  const [allTransactions, setAllTransactions] = useState<GeneratedToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTokenType, setSelectedTokenType] = useState<string>('all');
  // const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined); // Tetap dikomentari

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const tokensCollectionRef = collection(db, 'generated_tokens');
        const q = query(tokensCollectionRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedTransactions = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate() : new Date(0),
          } as GeneratedToken;
        });
        setAllTransactions(fetchedTransactions);
      } catch (err: any) {
        console.error("Error fetching transactions:", err);
        setError("Gagal memuat data transaksi. Silakan coba lagi.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const typeMatch = selectedTokenType === 'all' || tx.type.toLowerCase() === selectedTokenType;
      // const dateMatch = !dateRange || 
      //                   (tx.createdAt >= (dateRange.from || new Date(0)) && 
      //                    tx.createdAt <= (dateRange.to || new Date()));
      // return typeMatch && dateMatch; // dateMatch akan selalu true jika dateRange dikomentari
      return typeMatch;
    });
  }, [allTransactions, selectedTokenType /*, dateRange*/]);

  const summary: TransactionSummary = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalAmount = filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const averageAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;
    const uniqueCustomers = new Set(filteredTransactions.map(tx => tx.customerId)).size;
    return { totalTransactions, totalAmount, averageAmount, uniqueCustomers };
  }, [filteredTransactions]);

  const tokenTypeSummary: Record<string, TokenTypeSummaryItem> = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      const typeKey = tx.type.toLowerCase() || 'unknown';
      if (!acc[typeKey]) {
        acc[typeKey] = { count: 0, totalAmount: 0 };
      }
      acc[typeKey].count += 1;
      acc[typeKey].totalAmount += (tx.amount || 0);
      return acc;
    }, {} as Record<string, TokenTypeSummaryItem>);
  }, [filteredTransactions]);

  const availableTokenTypes = useMemo(() => {
    const types = new Set(allTransactions.map(tx => tx.type.toLowerCase()));
    return ['all', ...Array.from(types).sort()];
  }, [allTransactions]);

  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl border-primary/20">
        <CardHeader className="border-b border-primary/10 pb-4">
          <div className="flex items-center space-x-3 mb-2">
            <PieChartIcon className="h-9 w-9 text-primary" />
            <CardTitle className="text-3xl font-extrabold tracking-tight text-primary">Analisis Data Transaksi</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Dashboard analitik untuk memantau dan menganalisis tren transaksi token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
          <Card className="bg-muted/30 border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
              <CardTitle className="text-xl font-semibold flex items-center text-foreground/90">
                <FilterIcon className="mr-2.5 h-5 w-5 text-primary" />
                Filter Data
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <label htmlFor="date-range-picker" className="text-sm font-medium mb-1.5 block text-foreground/80">Rentang Tanggal (Dinonaktifkan)</label>
                {/* <DatePickerWithRange 
                  id="date-range-picker"
                  date={dateRange} 
                  onDateChange={setDateRange} 
                  className="w-full bg-background"
                  disabled={isLoading}
                /> */}
                 <Input type="text" value="Pemilih Tanggal Dinonaktifkan Sementara" disabled className="bg-muted/50" />
              </div>
              <div>
                <label htmlFor="token-type-filter" className="text-sm font-medium mb-1.5 block text-foreground/80">Jenis Token</label>
                <Select value={selectedTokenType} onValueChange={setSelectedTokenType} disabled={isLoading}>
                  <SelectTrigger id="token-type-filter" className="w-full bg-background">
                    <SelectValue placeholder="Pilih Jenis Token" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTokenTypes.map(type => {
                      const displayInfo = tokenTypeDisplayMap[type] || tokenTypeDisplayMap.unknown;
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center">
                            <displayInfo.icon className={cn("mr-2 h-4 w-4", displayInfo.colorClass)} />
                            {displayInfo.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-80 rounded-lg bg-card border border-dashed p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Memuat data analisis...</p>
              <p className="text-sm text-muted-foreground">Harap tunggu sebentar.</p>
            </div>
          ) : error ? (
            <Alert variant="destructive" className="max-w-xl mx-auto text-center py-6">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
              <AlertTitle className="text-lg font-semibold">Gagal Memuat Data</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>Coba Lagi</Button>
            </Alert>
          ) : (
            <>
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground/90 flex items-center">
                  <TrendingUp className="mr-3 h-6 w-6 text-accent" />
                  Ringkasan Umum
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    { title: "Total Transaksi", value: summary.totalTransactions.toLocaleString('id-ID'), icon: FilterIcon, desc: "Jumlah transaksi tercatat" },
                    { title: "Total Nominal (Rp)", value: summary.totalAmount.toLocaleString('id-ID'), icon: FilterIcon, desc: "Dari semua transaksi" },
                    { title: "Rata-rata Nominal (Rp)", value: summary.averageAmount.toLocaleString('id-ID', {maximumFractionDigits: 0}), icon: FilterIcon, desc: "Per transaksi" },
                    { title: "Pelanggan Unik", value: summary.uniqueCustomers.toLocaleString('id-ID'), icon: FilterIcon, desc: "Bertransaksi pada periode ini" },
                  ].map(item => (
                    <Card key={item.title} className="shadow-md hover:shadow-lg transition-shadow duration-300">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                        <item.icon className="h-5 w-5 text-primary" />
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="text-3xl font-bold text-primary">{item.value}</div>
                        <p className="text-xs text-muted-foreground pt-1">{item.desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground/90 flex items-center">
                  <PieChartIcon className="mr-3 h-6 w-6 text-accent" />
                  Distribusi per Jenis Token
                </h2>
                {Object.keys(tokenTypeSummary).length > 0 ? (
                  <Card className="shadow-md">
                    <CardContent className="pt-6">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[200px] text-foreground/90">Jenis Token</TableHead>
                              <TableHead className="text-right text-foreground/90">Jumlah Transaksi</TableHead>
                              <TableHead className="text-right text-foreground/90">Total Nominal (Rp)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(tokenTypeSummary).sort(([,a],[,b]) => b.count - a.count).map(([type, data]) => {
                                const displayInfo = tokenTypeDisplayMap[type] || tokenTypeDisplayMap.unknown;
                                return (
                                    <TableRow key={type}>
                                        <TableCell>
                                            <div className="flex items-center">
                                                <displayInfo.icon className={cn("mr-2 h-4 w-4", displayInfo.colorClass)} />
                                                {displayInfo.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">{data.count.toLocaleString('id-ID')}</TableCell>
                                        <TableCell className="text-right">{data.totalAmount.toLocaleString('id-ID')}</TableCell>
                                    </TableRow>
                                );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-10 text-center text-muted-foreground">
                      <PackageIcon className="h-12 w-12 mx-auto mb-3 text-foreground/30" />
                      Tidak ada data transaksi untuk ditampilkan berdasarkan filter saat ini.
                    </CardContent>
                  </Card>
                )}
              </section>
              
              <section className="space-y-4 opacity-60">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground/90 flex items-center">
                  <Activity className="mr-3 h-6 w-6 text-accent" />
                  Analisis Waktu (Segera Hadir)
                </h2>
                 <Card className="border-dashed"><CardContent className="p-10 text-center text-muted-foreground">Grafik tren transaksi harian/mingguan/bulanan akan ditampilkan di sini.</CardContent></Card>
              </section>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    
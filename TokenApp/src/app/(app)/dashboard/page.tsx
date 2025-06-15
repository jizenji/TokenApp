
'use client';

import { useAuth } from '@/hooks/use-auth';
import { UserRole, type PromotionData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Users, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { PromotionCard } from '@/components/dashboard/promotion-card';

export default function DashboardPage() {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<PromotionData[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);

  useEffect(() => {
    if (user && user.role === UserRole.CUSTOMER) {
      const fetchPromotions = async () => {
        setIsLoadingPromotions(true);
        try {
          const promotionsCol = collection(db, 'promotions');
          const q = query(promotionsCol, where('isActive', '==', true), orderBy('displayOrder', 'asc'), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const fetchedPromotions = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              imageUrl: data.imageUrl,
              altText: data.altText,
              linkUrl: data.linkUrl,
              isActive: data.isActive,
              displayOrder: data.displayOrder,
              createdAt: (data.createdAt as Timestamp).toDate(),
            } as PromotionData;
          });
          setPromotions(fetchedPromotions);
        } catch (error) {
          console.error("Error fetching promotions:", error);
          // Handle error, e.g., show a toast message
        } finally {
          setIsLoadingPromotions(false);
        }
      };
      fetchPromotions();
    } else {
      setIsLoadingPromotions(false);
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading user data...</p>
      </div>
    );
  }
  
  const welcomeMessage = `Welcome, ${user.displayName || 'User'}!`;
  let roleSpecificMessage = '';

  switch (user.role) {
    case UserRole.ADMIN:
      roleSpecificMessage = 'You have full access to all system features, including user management and system settings.';
      break;
    case UserRole.CUSTOMER:
      roleSpecificMessage = 'You can view your token usage, reports, and manage your profile.';
      break;
    case UserRole.TEKNISI:
      roleSpecificMessage = 'You can input new tokens, manage customer data, and view relevant reports.';
      break;
    default:
      roleSpecificMessage = 'Your role is not fully configured. Please contact support.';
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight">{welcomeMessage}</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">{roleSpecificMessage}</CardDescription>
        </CardHeader>
      </Card>

      {user.role === UserRole.CUSTOMER && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">Promotions</CardTitle>
            <CardDescription className="text-sm text-muted-foreground">Check out our latest offers and announcements!</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPromotions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading promotions...</p>
              </div>
            ) : promotions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {promotions.map(promo => (
                  <PromotionCard key={promo.id} promotion={promo} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No active promotions at the moment. Check back soon!</p>
            )}
          </CardContent>
        </Card>
      )}

      {user.role !== UserRole.CUSTOMER && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+10.2% from last month</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">573</div>
              <p className="text-xs text-muted-foreground">+2 since last hour</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reports Generated</CardTitle>
              <BarChart className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">+5 this week</p>
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === UserRole.ADMIN && (
        <Card className="hover:shadow-xl transition-shadow duration-300 border-primary/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">Admin Panel</CardTitle>
            <AlertTriangle className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Access User Management and System Settings for critical operations.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

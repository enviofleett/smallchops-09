import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCircle, UserCheck, UserPlus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerSegmentationProps {
  guestCount: number;
  registeredCount: number;
  firstTimeOrdersCount: number;
  totalCheckouts: number;
  isLoading?: boolean;
}

export function CustomerSegmentationCards({
  guestCount,
  registeredCount,
  firstTimeOrdersCount,
  totalCheckouts,
  isLoading,
}: CustomerSegmentationProps) {
  const guestPercentage = totalCheckouts > 0 ? (guestCount / totalCheckouts) * 100 : 0;
  const registeredPercentage = totalCheckouts > 0 ? (registeredCount / totalCheckouts) * 100 : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Guest Customers Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/10 border-blue-200 dark:border-blue-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <UserCircle className="h-4 w-4" />
            Guest Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-3xl font-black text-blue-900 dark:text-blue-100">
              {guestCount.toLocaleString()}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {guestPercentage.toFixed(1)}% of total checkouts
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Registered Customers Card */}
      <Card className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 dark:from-emerald-950/20 dark:to-emerald-950/10 border-emerald-200 dark:border-emerald-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <UserCheck className="h-4 w-4" />
            Registered Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-3xl font-black text-emerald-900 dark:text-emerald-100">
              {registeredCount.toLocaleString()}
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              {registeredPercentage.toFixed(1)}% of total checkouts
            </p>
          </div>
        </CardContent>
      </Card>

      {/* First-Time Orders Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            New Customer Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-3xl font-black text-primary">
              {firstTimeOrdersCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Orders from newly registered customers
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

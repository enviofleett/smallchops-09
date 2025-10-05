import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
  customers: number;
  newProducts: number;
  newCustomerRegistrations: number;
  topProducts: Array<{
    name: string;
    quantity: number;
  }>;
}

interface TopProductsPeriodProps {
  dailyMetrics?: DailyMetric[];
  isLoading?: boolean;
}

export const TopProductsPeriod: React.FC<TopProductsPeriodProps> = ({ dailyMetrics, isLoading }) => {
  const allTopProducts = useMemo(() => {
    if (!dailyMetrics || dailyMetrics.length === 0) return [];
    
    const productMap = new Map<string, { name: string; quantity: number }>();
    dailyMetrics.forEach(day => {
      day.topProducts?.forEach(product => {
        const existing = productMap.get(product.name);
        if (existing) {
          existing.quantity += product.quantity;
        } else {
          productMap.set(product.name, { 
            name: product.name, 
            quantity: product.quantity 
          });
        }
      });
    });
    return Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [dailyMetrics]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Products - Period View
          </CardTitle>
          <CardDescription>Loading top products...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-1/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (allTopProducts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Products - Period View
          </CardTitle>
          <CardDescription>Most purchased products across selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-sm text-muted-foreground">No product data available for this period</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Top Products - Period View
        </CardTitle>
        <CardDescription>Most purchased products by quantity across selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allTopProducts.map((product, idx) => (
            <div key={`${product.name}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  #{idx + 1}
                </div>
                <div>
                  <p className="font-medium text-sm">{product.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{product.quantity} units</p>
                <p className="text-xs text-muted-foreground">Total sold</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

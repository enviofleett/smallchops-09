import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingUp } from 'lucide-react';
import { TopProduct } from '@/hooks/useAdminDashboardData';

interface TopSellingProductsProps {
  products: TopProduct[];
  isLoading?: boolean;
}

export const TopSellingProducts: React.FC<TopSellingProductsProps> = ({
  products,
  isLoading = false
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Top Selling Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
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
          Top Selling Products
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p className="text-muted-foreground">No product sales data available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product, index) => (
              <div 
                key={product.id} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="min-w-[2rem] justify-center">
                    #{index + 1}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{product.quantity_sold} units sold</span>
                      <span>{product.total_orders} orders</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-600" />
                    <span className="font-medium text-sm">
                      {formatCurrency(product.revenue)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
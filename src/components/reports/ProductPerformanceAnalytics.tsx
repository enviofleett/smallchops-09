import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart, Star } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

interface ProductPerformanceData {
  topProducts?: Array<{
    id: string;
    name: string;
    totalSold: number;
    totalRevenue: number;
    averageRating?: number;
    categoryName?: string;
  }>;
  categoryPerformance?: Array<{
    category: string;
    totalSold: number;
    totalRevenue: number;
    productCount: number;
  }>;
  revenueByProduct?: Array<{
    productName: string;
    revenue: number;
    quantity: number;
  }>;
}

interface ProductPerformanceAnalyticsProps {
  data?: {
    productPerformance?: ProductPerformanceData;
  } | null;
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function ProductPerformanceAnalytics({ data, isLoading }: ProductPerformanceAnalyticsProps) {
  // Process top products data for charts
  const topProductsData = useMemo(() => {
    if (!data?.productPerformance?.topProducts) return [];
    return data.productPerformance.topProducts.slice(0, 5).map(product => ({
      name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
      fullName: product.name,
      sold: product.totalSold,
      revenue: product.totalRevenue,
    }));
  }, [data?.productPerformance?.topProducts]);

  // Process category performance data for pie chart
  const categoryData = useMemo(() => {
    if (!data?.productPerformance?.categoryPerformance) return [];
    return data.productPerformance.categoryPerformance.map((cat, index) => ({
      name: cat.category,
      value: cat.totalRevenue,
      quantity: cat.totalSold,
      color: COLORS[index % COLORS.length],
    }));
  }, [data?.productPerformance?.categoryPerformance]);

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    if (!data?.productPerformance) return null;
    
    const { topProducts, categoryPerformance } = data.productPerformance;
    
    const totalProductsSold = topProducts?.reduce((sum, p) => sum + p.totalSold, 0) || 0;
    const totalProductRevenue = topProducts?.reduce((sum, p) => sum + p.totalRevenue, 0) || 0;
    const averageOrderValue = totalProductsSold > 0 ? totalProductRevenue / totalProductsSold : 0;
    const totalCategories = categoryPerformance?.length || 0;
    const bestPerformingCategory = categoryPerformance?.[0]?.category || 'N/A';
    
    return {
      totalProductsSold,
      totalProductRevenue,
      averageOrderValue,
      totalCategories,
      bestPerformingCategory,
    };
  }, [data?.productPerformance]);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.productPerformance || !performanceMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No product performance data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Performance Analytics
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Insights into product sales and performance metrics
          </p>
        </CardHeader>
        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total Sold</span>
              </div>
              <div className="text-2xl font-bold">{performanceMetrics.totalProductsSold.toLocaleString()}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Product Revenue</span>
              </div>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-NG', { 
                  style: 'currency', 
                  currency: 'NGN',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                }).format(performanceMetrics.totalProductRevenue)}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-muted-foreground">Avg. Order Value</span>
              </div>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-NG', { 
                  style: 'currency', 
                  currency: 'NGN',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                }).format(performanceMetrics.averageOrderValue)}
              </div>
            </div>
          </div>

          {/* Top Performing Products Chart */}
          {topProductsData.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-4">Top Performing Products</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'sold' ? value : new Intl.NumberFormat('en-NG', { 
                        style: 'currency', 
                        currency: 'NGN',
                        minimumFractionDigits: 0 
                      }).format(value as number),
                      name === 'sold' ? 'Units Sold' : 'Revenue'
                    ]}
                    labelFormatter={(label) => {
                      const product = topProductsData.find(p => p.name === label);
                      return product?.fullName || label;
                    }}
                  />
                  <Bar dataKey="sold" fill="#3b82f6" name="sold" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Performance */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Performance by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Revenue Chart */}
              <div>
                <h4 className="text-base font-semibold mb-4">Revenue Distribution</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [
                        new Intl.NumberFormat('en-NG', { 
                          style: 'currency', 
                          currency: 'NGN',
                          minimumFractionDigits: 0 
                        }).format(value as number),
                        'Revenue'
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category List */}
              <div>
                <h4 className="text-base font-semibold mb-4">Category Breakdown</h4>
                <div className="space-y-3">
                  {categoryData.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {new Intl.NumberFormat('en-NG', { 
                            style: 'currency', 
                            currency: 'NGN',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0 
                          }).format(category.value)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {category.quantity} units
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products List */}
      {data.productPerformance.topProducts && data.productPerformance.topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Best Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.productPerformance.topProducts.slice(0, 6).map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="w-8 h-8 rounded-full flex items-center justify-center">
                      {index + 1}
                    </Badge>
                    <div>
                      <h4 className="font-medium">{product.name}</h4>
                      {product.categoryName && (
                        <p className="text-sm text-muted-foreground">{product.categoryName}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {new Intl.NumberFormat('en-NG', { 
                        style: 'currency', 
                        currency: 'NGN',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0 
                      }).format(product.totalRevenue)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {product.totalSold} sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
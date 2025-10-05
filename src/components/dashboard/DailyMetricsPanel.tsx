import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Users, ShoppingCart, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight, UserPlus } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';

interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
  cancelledOrders?: number;
  customers: number;
  newProducts: number;
  newCustomerRegistrations: number;
  topCustomers: Array<{
    name: string;
    email: string;
    orders: number;
    spending: number;
  }>;
  topProducts: Array<{
    name: string;
    quantity: number;
  }>;
  growth: number;
  growthDirection: 'up' | 'down' | 'flat';
}

interface DailyMetricsPanelProps {
  dailyData: DailyMetric[];
  isLoading?: boolean;
}

// Custom Tooltip Component for enhanced UX
const CustomTooltip = ({ active, payload, label, formatter }: TooltipProps<any, any> & { formatter?: (value: any) => [string, string] }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-200">
        <p className="font-semibold text-sm mb-2 text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => {
          const formattedValue = formatter ? formatter(entry.value) : [entry.value.toString(), entry.name || ''];
          return (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground">{formattedValue[1]}:</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {formattedValue[0]}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export const DailyMetricsPanel: React.FC<DailyMetricsPanelProps> = ({ dailyData, isLoading }) => {
  // CRITICAL: Always call hooks BEFORE any conditional returns to avoid hooks violations
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Calculate all metrics first (hooks must always be called in same order)
  const sortedData = useMemo(() => {
    return [...dailyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [dailyData]);

  const selectedMetric = useMemo(() => {
    if (!selectedDate) return sortedData[sortedData.length - 1];
    return sortedData.find(d => d.date === selectedDate) || sortedData[sortedData.length - 1];
  }, [selectedDate, sortedData]);

  const periodSummary = useMemo(() => {
    if (sortedData.length === 0) {
      return { totalRevenue: 0, totalOrders: 0, totalProducts: 0, totalCustomers: 0, avgRevenue: 0, avgOrders: 0 };
    }
    const totalRevenue = sortedData.reduce((sum, d) => sum + d.revenue, 0);
    const totalOrders = sortedData.reduce((sum, d) => sum + d.orders, 0);
    const totalProducts = sortedData.reduce((sum, d) => sum + d.newProducts, 0);
    const totalCustomers = sortedData.reduce((sum, d) => sum + d.newCustomerRegistrations, 0);
    return {
      totalRevenue,
      totalOrders,
      totalProducts,
      totalCustomers,
      avgRevenue: totalRevenue / sortedData.length,
      avgOrders: totalOrders / sortedData.length
    };
  }, [sortedData]);

  const allTopCustomers = useMemo(() => {
    const customerMap = new Map<string, { name: string; email: string; orders: number; spending: number }>();
    sortedData.forEach(day => {
      day.topCustomers?.forEach(customer => {
        const existing = customerMap.get(customer.email);
        if (existing) {
          existing.orders += customer.orders;
          existing.spending += customer.spending;
        } else {
          customerMap.set(customer.email, { 
            name: customer.name, 
            email: customer.email,
            orders: customer.orders,
            spending: customer.spending 
          });
        }
      });
    });
    return Array.from(customerMap.values())
      .sort((a, b) => b.spending - a.spending)
      .slice(0, 10);
  }, [sortedData]);

  const allTopProducts = useMemo(() => {
    const productMap = new Map<string, { name: string; quantity: number }>();
    sortedData.forEach(day => {
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
  }, [sortedData]);

  // Track first-time customers for the period
  const firstTimeCustomers = useMemo(() => {
    const customerFirstOrder = new Map<string, { 
      name: string; 
      email: string; 
      firstOrderDate: string;
      spending: number;
    }>();
    
    // Process each day to find first appearances
    sortedData.forEach(day => {
      day.topCustomers?.forEach(customer => {
        if (!customerFirstOrder.has(customer.email)) {
          customerFirstOrder.set(customer.email, {
            name: customer.name,
            email: customer.email,
            firstOrderDate: day.date,
            spending: customer.spending
          });
        }
      });
    });

    // Return customers sorted by first order date (most recent first)
    return Array.from(customerFirstOrder.values())
      .sort((a, b) => new Date(b.firstOrderDate).getTime() - new Date(a.firstOrderDate).getTime())
      .slice(0, 10);
  }, [sortedData]);

  // NOW handle loading state after all hooks
  if (isLoading || sortedData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Metrics</CardTitle>
          <CardDescription>Loading daily analytics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Validate and sanitize daily data
  const validDailyData = Array.isArray(dailyData) 
    ? dailyData.filter(day => day && typeof day === 'object' && day.date)
    : [];

  if (validDailyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Metrics</CardTitle>
          <CardDescription>No data available for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 opacity-50 mb-4" />
            <p className="text-muted-foreground">Start receiving orders to see daily metrics</p>
            <p className="text-xs text-muted-foreground mt-2">Data will appear here once you have orders in the system</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  // Use selectedMetric from useMemo at top (already calculated)

  // Date navigation
  const currentIndex = selectedDate 
    ? validDailyData.findIndex(d => d.date === selectedDate)
    : validDailyData.length - 1;

  const goToPreviousDay = () => {
    if (currentIndex > 0) {
      setSelectedDate(validDailyData[currentIndex - 1].date);
    }
  };

  const goToNextDay = () => {
    if (currentIndex < validDailyData.length - 1) {
      setSelectedDate(validDailyData[currentIndex + 1].date);
    }
  };

  const goToToday = () => {
    setSelectedDate(validDailyData[validDailyData.length - 1].date);
  };

  // Prepare chart data with safe access and validation
  const chartData = validDailyData.map(day => ({
    date: formatDate(day.date || ''),
    fullDate: day.date || '',
    orders: Number(day.orders) || 0,
    cancelledOrders: Number(day.cancelledOrders) || 0,
    revenue: (Number(day.revenue) || 0) / 100, // Convert to thousands for better display
    customers: Number(day.customers) || 0,
    newProducts: Number(day.newProducts) || 0,
    newCustomers: Number(day.newCustomerRegistrations) || 0
  }));

  return (
    <div className="space-y-6">
      {/* Period Summary Cards */}
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-background to-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
                Period Summary
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Aggregate metrics across selected date range
              </CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs sm:text-sm font-medium text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">
                {formatDate(validDailyData[0]?.date || '')} - {formatDate(validDailyData[validDailyData.length - 1]?.date || '')}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {/* Total Revenue */}
            <div className="group relative bg-gradient-to-br from-emerald-50/50 via-background to-background dark:from-emerald-950/20 dark:via-background dark:to-background p-4 sm:p-5 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Total Revenue
                  </p>
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-200/50 dark:border-emerald-800/50 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-emerald-700 dark:text-emerald-300 mb-2 tracking-tight">
                  {formatCurrency(periodSummary.totalRevenue)}
                </p>
                <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-bold text-foreground">{formatCurrency(periodSummary.avgRevenue)}</span>
                  <span className="text-muted-foreground">/day</span>
                </div>
              </div>
            </div>

            {/* Total Orders */}
            <div className="group relative bg-gradient-to-br from-blue-50/50 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background p-4 sm:p-5 rounded-xl border border-blue-200/50 dark:border-blue-800/30 hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Total Orders
                  </p>
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center border border-blue-200/50 dark:border-blue-800/50 group-hover:scale-110 transition-transform">
                    <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-blue-700 dark:text-blue-300 mb-2 tracking-tight">
                  {periodSummary.totalOrders.toLocaleString()}
                </p>
                <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Avg:</span>
                  <span className="font-bold text-foreground">{periodSummary.avgOrders.toFixed(1)}</span>
                  <span className="text-muted-foreground">/day</span>
                </div>
              </div>
            </div>

            {/* First-Time Orders - Premium Highlight */}
            <div className="group relative bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 dark:from-primary/20 dark:via-primary/10 dark:to-accent/20 p-4 sm:p-5 rounded-xl border-2 border-primary/40 dark:border-primary/50 hover:border-primary dark:hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-0.5 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl -ml-12 -mb-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-bold text-primary uppercase tracking-wider">
                    First-Time Orders
                  </p>
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/20 dark:bg-primary/30 flex items-center justify-center border-2 border-primary/50 dark:border-primary/60 group-hover:scale-110 transition-transform ring-4 ring-primary/10">
                    <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                </div>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-black text-primary mb-2 tracking-tight">
                  {firstTimeCustomers.length}
                </p>
                <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
                  <span className="text-primary/80 font-bold">New Acquisitions</span>
                </div>
              </div>
            </div>

            {/* New Customers */}
            <div className="group relative bg-gradient-to-br from-orange-50/50 via-background to-background dark:from-orange-950/20 dark:via-background dark:to-background p-4 sm:p-5 rounded-xl border border-orange-200/50 dark:border-orange-800/30 hover:border-orange-300 dark:hover:border-orange-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                    Total Customers
                  </p>
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center border border-orange-200/50 dark:border-orange-800/50 group-hover:scale-110 transition-transform">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-orange-700 dark:text-orange-300 mb-2 tracking-tight">
                  {periodSummary.totalCustomers.toLocaleString()}
                </p>
                <div className="flex items-baseline gap-1.5 text-xs sm:text-sm">
                  <span className="text-muted-foreground font-medium">Registered in period</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily View</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousDay}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextDay}
                disabled={currentIndex === validDailyData.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Viewing: {selectedMetric ? format(parseISO(selectedMetric.date), 'MMMM dd, yyyy') : 'No date selected'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedMetric?.orders || 0}</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {selectedMetric && selectedMetric.cancelledOrders ? (
                <span className="text-orange-600">{selectedMetric.cancelledOrders} cancelled</span>
              ) : (
                selectedMetric && selectedMetric.growthDirection === 'up' ? (
                  <><TrendingUp className="h-3 w-3 mr-1 text-green-600" /> {Math.abs(selectedMetric.growth).toFixed(1)}%</>
                ) : selectedMetric && selectedMetric.growthDirection === 'down' ? (
                  <><TrendingDown className="h-3 w-3 mr-1 text-red-600" /> {Math.abs(selectedMetric.growth).toFixed(1)}%</>
                ) : (
                  <><Minus className="h-3 w-3 mr-1" /> No change</>
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              New Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedMetric?.newProducts || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Products added today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              New Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedMetric?.newCustomerRegistrations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registered today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(selectedMetric?.revenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total today
            </p>
          </CardContent>
        </Card>
          </div>
        </CardContent>
      </Card>


      {/* Charts */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Orders Trend</CardTitle>
              <CardDescription>Completed vs cancelled orders each day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Bar 
                      dataKey="orders" 
                      fill="hsl(var(--primary))" 
                      name="Completed Orders" 
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                      animationBegin={0}
                    />
                    <Bar 
                      dataKey="cancelledOrders" 
                      fill="hsl(var(--destructive))" 
                      name="Cancelled Orders" 
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                      animationBegin={200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Product Additions</CardTitle>
              <CardDescription>New products added each day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="productGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={<CustomTooltip formatter={(value: any) => [value.toString(), 'Products'] as [string, string]} />}
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="newProducts" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ 
                        fill: 'hsl(var(--background))', 
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: 2,
                        r: 4
                      }}
                      activeDot={{ 
                        r: 6, 
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: 2,
                        fill: 'hsl(var(--primary))',
                        className: 'animate-pulse'
                      }}
                      fill="url(#productGradient)"
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Customer Growth</CardTitle>
              <CardDescription>New customer registrations per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Bar 
                      dataKey="newCustomers" 
                      fill="hsl(var(--primary))" 
                      name="New Registrations"
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                      animationBegin={0}
                    />
                    <Bar 
                      dataKey="customers" 
                      fill="hsl(var(--secondary))" 
                      name="Active Customers"
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                      animationBegin={200}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue Trend</CardTitle>
              <CardDescription>Revenue generated each day (in thousands ₦)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `₦${value}k`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      content={<CustomTooltip formatter={(value: any) => [formatCurrency(value * 100), 'Revenue'] as [string, string]} />}
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ 
                        fill: 'hsl(var(--background))', 
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: 2,
                        r: 5
                      }}
                      activeDot={{ 
                        r: 8, 
                        stroke: 'hsl(var(--primary))',
                        strokeWidth: 3,
                        fill: 'hsl(var(--primary))',
                        className: 'animate-pulse'
                      }}
                      fill="url(#revenueGradient)"
                      animationDuration={1200}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

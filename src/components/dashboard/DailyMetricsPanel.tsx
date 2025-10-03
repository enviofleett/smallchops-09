import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Users, ShoppingCart, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Period Summary</span>
            <span className="text-sm text-muted-foreground font-normal">
              {formatDate(validDailyData[0]?.date || '')} - {formatDate(validDailyData[validDailyData.length - 1]?.date || '')}
            </span>
          </CardTitle>
          <CardDescription>Total metrics for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{formatCurrency(periodSummary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Avg: {formatCurrency(periodSummary.avgRevenue)}/day</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{periodSummary.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Avg: {periodSummary.avgOrders.toFixed(1)}/day</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">New Products</p>
              <p className="text-2xl font-bold">{periodSummary.totalProducts}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">New Customers</p>
              <p className="text-2xl font-bold">{periodSummary.totalCustomers}</p>
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

      {/* Top Products for Entire Period */}
      {allTopProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Products - Entire Period</CardTitle>
            <CardDescription>Most purchased products by quantity across all dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allTopProducts.map((product, idx) => (
                <div key={`${product.name}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
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
      )}

      {/* Top Customers for Entire Period */}
      {allTopCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Customers - Entire Period</CardTitle>
            <CardDescription>Customers with highest spending across all dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allTopCustomers.map((customer, idx) => (
                <div key={`${customer.email}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{customer.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{customer.email || 'No email'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(customer.spending)}</p>
                    <p className="text-xs text-muted-foreground">{customer.orders} orders</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

          {/* Top Customers for Selected Day */}
          {selectedMetric && Array.isArray(selectedMetric.topCustomers) && selectedMetric.topCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Customers - {formatDate(selectedMetric.date || '')}</CardTitle>
                <CardDescription>Customers with highest spending</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedMetric.topCustomers.map((customer, idx) => (
                    <div key={`${customer.email}-${idx}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{customer.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{customer.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(Number(customer.spending) || 0)}</p>
                        <p className="text-xs text-muted-foreground">{Number(customer.orders) || 0} orders</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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

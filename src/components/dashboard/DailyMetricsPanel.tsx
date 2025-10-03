import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Users, ShoppingCart, TrendingUp, TrendingDown, Minus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

export const DailyMetricsPanel: React.FC<DailyMetricsPanelProps> = ({ dailyData, isLoading }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (isLoading) {
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

  // Calculate period summaries
  const periodSummary = useMemo(() => {
    return validDailyData.reduce((acc, day) => ({
      totalRevenue: acc.totalRevenue + (Number(day.revenue) || 0),
      totalOrders: acc.totalOrders + (Number(day.orders) || 0),
      totalProducts: acc.totalProducts + (Number(day.newProducts) || 0),
      totalCustomers: acc.totalCustomers + (Number(day.newCustomerRegistrations) || 0),
      avgDailyRevenue: 0, // Will calculate after
      avgDailyOrders: 0,
    }), {
      totalRevenue: 0,
      totalOrders: 0,
      totalProducts: 0,
      totalCustomers: 0,
      avgDailyRevenue: 0,
      avgDailyOrders: 0,
    });
  }, [validDailyData]);

  // Calculate averages
  periodSummary.avgDailyRevenue = validDailyData.length > 0 
    ? periodSummary.totalRevenue / validDailyData.length 
    : 0;
  periodSummary.avgDailyOrders = validDailyData.length > 0 
    ? periodSummary.totalOrders / validDailyData.length 
    : 0;

  // Collect all top customers across all days
  const allTopCustomers = useMemo(() => {
    const customerMap = new Map();
    validDailyData.forEach(day => {
      if (Array.isArray(day.topCustomers)) {
        day.topCustomers.forEach(customer => {
          const existing = customerMap.get(customer.email);
          if (existing) {
            existing.orders += Number(customer.orders) || 0;
            existing.spending += Number(customer.spending) || 0;
          } else {
            customerMap.set(customer.email, {
              name: customer.name,
              email: customer.email,
              orders: Number(customer.orders) || 0,
              spending: Number(customer.spending) || 0,
            });
          }
        });
      }
    });
    return Array.from(customerMap.values())
      .sort((a, b) => b.spending - a.spending)
      .slice(0, 10);
  }, [validDailyData]);

  const selectedMetric = selectedDate 
    ? validDailyData.find(d => d.date === selectedDate) 
    : validDailyData[validDailyData.length - 1];

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
              <p className="text-xs text-muted-foreground">Avg: {formatCurrency(periodSummary.avgDailyRevenue)}/day</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{periodSummary.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Avg: {periodSummary.avgDailyOrders.toFixed(1)}/day</p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" name="Completed Orders" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelledOrders" fill="hsl(var(--destructive))" name="Cancelled Orders" radius={[4, 4, 0, 0]} />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      formatter={(value: any) => [value, 'Products']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="newProducts" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="newCustomers" 
                      fill="hsl(var(--primary))" 
                      name="New Registrations"
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="customers" 
                      fill="hsl(var(--secondary))" 
                      name="Active Customers"
                      radius={[4, 4, 0, 0]} 
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
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `₦${value}k`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      formatter={(value: any) => [formatCurrency(value * 100), 'Revenue']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
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

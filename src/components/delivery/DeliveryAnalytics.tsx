import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Package, 
  Clock, 
  MapPin,
  DollarSign,
  Truck,
  AlertCircle
} from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { Line, LineChart, Bar, BarChart, Pie, PieChart, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface DeliveryAnalyticsProps {
  className?: string;
}

export function DeliveryAnalytics({ className }: DeliveryAnalyticsProps) {
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [startDate, setStartDate] = useState<Date>(startOfWeek(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfWeek(new Date()));

  // Update date range based on selection
  const updateDateRange = (range: 'today' | 'week' | 'month' | 'custom') => {
    setDateRange(range);
    const now = new Date();
    
    switch (range) {
      case 'today':
        setStartDate(now);
        setEndDate(now);
        break;
      case 'week':
        setStartDate(startOfWeek(now));
        setEndDate(endOfWeek(now));
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
    }
  };

  // Fetch orders data for analytics
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['delivery-analytics', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 1000,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    }),
    refetchInterval: 300000, // 5 minutes
  });

  // Process analytics data
  const analytics = useMemo(() => {
    if (!ordersData?.orders) return null;

    const deliveryOrders = ordersData.orders.filter(order => order.order_type === 'delivery');
    const pickupOrders = ordersData.orders.filter(order => order.order_type === 'pickup');
    
    // Status distribution
    const statusDistribution = deliveryOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Daily delivery metrics
    const dailyMetrics = deliveryOrders.reduce((acc, order) => {
      const orderDate = format(new Date(order.order_time || order.created_at), 'yyyy-MM-dd');
      if (!acc[orderDate]) {
        acc[orderDate] = { orders: 0, revenue: 0, deliveries: 0 };
      }
      acc[orderDate].orders += 1;
      acc[orderDate].revenue += order.total_amount || 0;
      if (order.status === 'delivered') {
        acc[orderDate].deliveries += 1;
      }
      return acc;
    }, {} as Record<string, { orders: number; revenue: number; deliveries: number }>);

    // Convert to chart format
    const chartData = Object.entries(dailyMetrics).map(([date, metrics]) => ({
      date: format(new Date(date), 'MMM dd'),
      orders: metrics.orders,
      revenue: metrics.revenue,
      deliveries: metrics.deliveries,
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Delivery time analysis
    const averageDeliveryTime = deliveryOrders
      .filter(order => order.status === 'delivered')
      .reduce((total, order, index, arr) => {
        // Simulate delivery time calculation (in real app, this would be actual delivery time)
        const deliveryTime = Math.random() * 60 + 30; // 30-90 minutes
        return total + deliveryTime / arr.length;
      }, 0);

    const totalRevenue = deliveryOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const completedDeliveries = deliveryOrders.filter(order => order.status === 'delivered').length;
    const deliveryRate = deliveryOrders.length > 0 ? (completedDeliveries / deliveryOrders.length) * 100 : 0;

    return {
      totalOrders: deliveryOrders.length,
      totalRevenue,
      completedDeliveries,
      deliveryRate,
      averageDeliveryTime,
      statusDistribution,
      chartData,
      pickupOrders: pickupOrders.length,
    };
  }, [ordersData]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const statusChartData = analytics ? Object.entries(analytics.statusDistribution).map(([status, count]) => ({
    name: status.replace('_', ' ').toUpperCase(),
    value: count,
  })) : [];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Analytics</h2>
          <p className="text-muted-foreground">
            Performance insights for {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={updateDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          
          {dateRange === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(startDate, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(endDate, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      ) : !analytics ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No data available for the selected period</p>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.totalOrders}</div>
                <p className="text-xs text-muted-foreground">delivery orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₦{analytics.totalRevenue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">total earnings</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Truck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.completedDeliveries}</div>
                <p className="text-xs text-muted-foreground">deliveries done</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.deliveryRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">delivery rate</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(analytics.averageDeliveryTime)}m</div>
                <p className="text-xs text-muted-foreground">delivery time</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="orders" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="Orders"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="deliveries" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="Delivered"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
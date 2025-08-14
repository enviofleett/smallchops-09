import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PriceDisplay } from '@/components/ui/price-display';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  Calendar as CalendarIcon,
  DollarSign,
  Package,
  Clock,
  Target,
  Users,
  MapPin
} from 'lucide-react';
import { useDeliveryReports } from '@/hooks/useDeliveryReports';
import { format } from 'date-fns';
import { exportDeliveryReports } from '@/api/deliveryReportsApi';
import { toast } from '@/hooks/use-toast';

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

export function DeliveryReports() {
  const [filters, setFilters] = useState<{
    period: 'today' | 'week' | 'month' | 'quarter' | 'custom';
    startDate: string;
    endDate: string;
  }>({
    period: 'week',
    startDate: '',
    endDate: '',
  });

  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined
  });

  const { data, isLoading, error, refetch, refreshAnalytics, isRefreshing } = useDeliveryReports(filters);

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'quarter' | 'custom') => {
    setFilters(prev => ({ ...prev, period }));
    
    if (period !== 'custom') {
      setCustomDateRange({ from: undefined, to: undefined });
    }
  };

  const handleCustomDateChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setCustomDateRange(range);
    
    if (range.from && range.to) {
      setFilters(prev => ({
        ...prev,
        period: 'custom',
        startDate: format(range.from!, 'yyyy-MM-dd'),
        endDate: format(range.to!, 'yyyy-MM-dd')
      }));
    }
  };

  const handleExport = async (exportFormat: 'csv' | 'pdf') => {
    try {
      const url = await exportDeliveryReports(
        filters.startDate || format(new Date(), 'yyyy-MM-dd'),
        filters.endDate || format(new Date(), 'yyyy-MM-dd'),
        exportFormat
      );
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `delivery-reports-${exportFormat}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: `Report exported as ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export report. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="text-destructive">Failed to load delivery reports</div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Reports</h2>
          <p className="text-muted-foreground">
            Comprehensive analytics for delivery performance and revenue
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={filters.period}
            onValueChange={handlePeriodChange}
          >
            <SelectTrigger className="w-auto min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="quarter">Last 90 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {filters.period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {customDateRange.from && customDateRange.to
                    ? `${format(customDateRange.from, 'MMM dd')} - ${format(customDateRange.to, 'MMM dd')}`
                    : 'Select dates'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customDateRange}
                  onSelect={handleCustomDateChange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button
            onClick={() => refreshAnalytics()}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => handleExport('csv')}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data?.summary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            <div className="text-2xl font-bold">
              <PriceDisplay originalPrice={data.summary.total_revenue} />
            </div>
              {data.trends && (
                <div className="flex items-center text-xs text-muted-foreground">
                  {data.trends.revenueGrowth > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  )}
                  {Math.abs(data.trends.revenueGrowth).toFixed(1)}% from previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.total_deliveries}</div>
              {data.trends && (
                <div className="flex items-center text-xs text-muted-foreground">
                  {data.trends.deliveryGrowth > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  )}
                  {Math.abs(data.trends.deliveryGrowth).toFixed(1)}% from previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.average_success_rate}%</div>
              {data.trends && (
                <div className="flex items-center text-xs text-muted-foreground">
                  {data.trends.successRateTrend > 0 ? (
                    <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1 text-red-500" />
                  )}
                  {Math.abs(data.trends.successRateTrend).toFixed(1)}% from previous period
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.summary.average_delivery_time}min</div>
              <p className="text-xs text-muted-foreground">
                Average time per delivery
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.daily_analytics.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.daily_analytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="total_delivery_fees" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery Trends</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : data?.daily_analytics.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.daily_analytics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="total_deliveries" 
                    stroke="#8884d8" 
                    name="Total Deliveries"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completed_deliveries" 
                    stroke="#82ca9d" 
                    name="Completed"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="failed_deliveries" 
                    stroke="#ffc658" 
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Driver and Zone Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Drivers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Performing Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.topDrivers?.length ? (
              <div className="space-y-3">
                {data.topDrivers.map((driver, index) => (
                  <div key={driver.driver_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{driver.driver_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {driver.total_deliveries} deliveries • {driver.success_rate}% success
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <PriceDisplay originalPrice={driver.total_fees_collected} className="font-semibold" />
                      <p className="text-xs text-muted-foreground">
                        {driver.average_delivery_time?.toFixed(0) || 0}min avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No driver data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Zones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Top Delivery Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.topZones?.length ? (
              <div className="space-y-3">
                {data.topZones.map((zone, index) => (
                  <div key={zone.zone_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium">{zone.zone_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {zone.total_deliveries} deliveries • {zone.success_rate}% success
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <PriceDisplay originalPrice={zone.total_fees} className="font-semibold" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No zone data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';
import { RevenueTable } from '@/components/reports/advanced/RevenueTable';
import { ProductsSoldTable } from '@/components/reports/advanced/ProductsSoldTable';
import { ProductTrendsChart } from '@/components/reports/advanced/ProductTrendsChart';
import { DriverRevenueTable } from '@/components/reports/advanced/DriverRevenueTable';
import { DeliveryFeesTable } from '@/components/reports/advanced/DeliveryFeesTable';
import {
  useDailyRevenue,
  useProductsSold,
} from '@/hooks/useAdvancedReports';
import { useDashboardAggregates } from '@/hooks/useDashboardAggregates';
import { Card, CardContent } from '@/components/ui/card';


export default function Reports() {
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  // Validate and normalize dates for production
  const validStartDate = React.useMemo(() => {
    const date = new Date(startDate);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [startDate]);

  const validEndDate = React.useMemo(() => {
    const date = new Date(endDate);
    date.setHours(23, 59, 59, 999);
    return date;
  }, [endDate]);

  // Production validation: Ensure dates are valid
  React.useEffect(() => {
    if (validStartDate > validEndDate) {
      console.error('⚠️ Invalid date range: Start date is after end date');
      setEndDate(new Date(validStartDate));
    }
    
    const daysDiff = Math.ceil((validEndDate.getTime() - validStartDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      console.warn('⚠️ Date range exceeds 365 days, performance may be affected');
    }
  }, [validStartDate, validEndDate]);

  // Fetch data using custom hooks with validated dates
  const { data: revenueData, isLoading: revenueLoading } = useDailyRevenue(validStartDate, validEndDate);
  const { data: productsData, isLoading: productsLoading } = useProductsSold(validStartDate, validEndDate, interval);
  const { data: aggregates, isLoading: aggregatesLoading } = useDashboardAggregates(validStartDate, validEndDate, interval);
  const driverData = aggregates?.driverRevenue;
  const dashboardData = aggregates?.stats;

  return (
    <div className="space-y-6 p-6">
      {/* Header & Filters */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive business intelligence and actionable insights
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          {/* Interval Selector */}
          <Select 
            value={interval} 
            onValueChange={(v: 'day' | 'week' | 'month') => {
              if (['day', 'week', 'month'].includes(v)) {
                setInterval(v);
              } else {
                console.error('⚠️ Invalid interval value:', v);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(!startDate && 'text-muted-foreground')}>
                <Calendar className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={startDate}
                onSelect={(date) => {
                  if (date) {
                    const normalizedDate = new Date(date);
                    normalizedDate.setHours(0, 0, 0, 0);
                    
                    if (normalizedDate > endDate) {
                      setStartDate(normalizedDate);
                      setEndDate(normalizedDate);
                    } else {
                      setStartDate(normalizedDate);
                    }
                  }
                }}
                disabled={(date) => date > new Date() || date > endDate}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn(!endDate && 'text-muted-foreground')}>
                <Calendar className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  if (date) {
                    const normalizedDate = new Date(date);
                    normalizedDate.setHours(23, 59, 59, 999);
                    
                    if (normalizedDate < startDate) {
                      setStartDate(normalizedDate);
                      setEndDate(normalizedDate);
                    } else {
                      setEndDate(normalizedDate);
                    }
                  }
                }}
                disabled={(date) => date < startDate || date > new Date()}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary KPIs */}
      {dashboardData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">
                ₦{Number(dashboardData.totalRevenue || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground">Total Orders</div>
              <div className="text-2xl font-bold">
                {Number(dashboardData.totalOrders || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground">Products Sold</div>
              <div className="text-2xl font-bold">
                {Number(dashboardData.totalProducts || 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground">Avg Order Value</div>
              <div className="text-2xl font-bold">
                ₦{Number((dashboardData.totalRevenue || 0) / Math.max(dashboardData.totalOrders || 0, 1)).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="products">Products Sold</TabsTrigger>
          <TabsTrigger value="trends">Product Trends</TabsTrigger>
          <TabsTrigger value="drivers">Driver Revenue</TabsTrigger>
          <TabsTrigger value="delivery-fees">Delivery Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <RevenueTable data={revenueData} isLoading={revenueLoading} />
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <ProductsSoldTable data={productsData} isLoading={productsLoading} />
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <ProductTrendsChart startDate={validStartDate} endDate={validEndDate} interval={interval} />
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <DriverRevenueTable data={driverData} isLoading={aggregatesLoading} />
        </TabsContent>

        <TabsContent value="delivery-fees" className="space-y-4">
          <DeliveryFeesTable startDate={validStartDate} endDate={validEndDate} interval={interval} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

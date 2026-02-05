import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Star,
  Truck,
  Calendar,
  Download,
  Users
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDriverManagement } from '@/hooks/useDriverManagement';

interface DriverPerformance {
  driver_id: string;
  driver_name: string;
  week_start_date: string;
  week_end_date: string;
  orders_completed: number;
  orders_failed: number;
  total_delivery_fees: number;
  average_delivery_time_minutes: number;
  customer_ratings_average: number;
  total_customer_ratings: number;
}

export function DriverPerformanceDashboard() {
  const [selectedWeek, setSelectedWeek] = useState(0); // 0 = current week, -1 = last week, etc.
  const [selectedDriverId, setSelectedDriverId] = useState<string>('all');

  const { drivers } = useDriverManagement();

  // Calculate week dates
  const weekStart = useMemo(() => {
    const date = addWeeks(new Date(), selectedWeek);
    return startOfWeek(date, { weekStartsOn: 1 }); // Monday start
  }, [selectedWeek]);

  const weekEnd = useMemo(() => {
    return endOfWeek(weekStart, { weekStartsOn: 1 });
  }, [weekStart]);

  // Fetch driver performance data
  const { data: performanceData = [], isLoading, error } = useQuery({
    queryKey: ['driver-performance', format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('delivery_assignments')
        .select(`
          driver_id,
          status,
          assigned_at,
          started_at,
          completed_at,
          failed_at,
          customer_rating,
          orders (
            total_amount,
            order_number
          ),
          drivers (
            name,
            phone,
            vehicle_type
          )
        `)
        .gte('assigned_at', format(weekStart, 'yyyy-MM-dd'))
        .lte('assigned_at', format(weekEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      // Defensive: handle if data is null or not an array
      if (!Array.isArray(data)) return [];

      // Process the data to calculate performance metrics
      const driverMap = new Map<string, DriverPerformance>();

      data.forEach((assignment: any) => {
        if (!assignment?.driver_id) return; // skip invalid rows

        const driverId = assignment.driver_id;
        const driverName = assignment.drivers?.name || 'Unknown Driver';
        
        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, {
            driver_id: driverId,
            driver_name: driverName,
            week_start_date: format(weekStart, 'yyyy-MM-dd'),
            week_end_date: format(weekEnd, 'yyyy-MM-dd'),
            orders_completed: 0,
            orders_failed: 0,
            total_delivery_fees: 0,
            average_delivery_time_minutes: 0,
            customer_ratings_average: 0,
            total_customer_ratings: 0,
          });
        }

        const performance = driverMap.get(driverId)!;

        if (assignment.status === 'completed') {
          performance.orders_completed++;
          performance.total_delivery_fees += (assignment.orders?.total_amount || 0) * 0.1; // 10% commission
          
          // Calculate delivery time
          if (assignment.started_at && assignment.completed_at) {
            const started = new Date(assignment.started_at);
            const completed = new Date(assignment.completed_at);
            if (!isNaN(started.getTime()) && !isNaN(completed.getTime())) {
              const deliveryTime = (completed.getTime() - started.getTime()) / (1000 * 60);
              performance.average_delivery_time_minutes = 
                (performance.average_delivery_time_minutes * (performance.orders_completed - 1) + deliveryTime) / performance.orders_completed;
            }
          }
        } else if (assignment.status === 'failed') {
          performance.orders_failed++;
        }

        // Handle ratings
        if (typeof assignment.customer_rating === 'number') {
          performance.total_customer_ratings++;
          performance.customer_ratings_average = 
            (performance.customer_ratings_average * (performance.total_customer_ratings - 1) + assignment.customer_rating) / performance.total_customer_ratings;
        }
      });

      return Array.from(driverMap.values());
    },
  });

  // Filter data by selected driver
  const filteredData = useMemo(() => {
    if (selectedDriverId === 'all') return performanceData;
    return performanceData.filter(p => p.driver_id === selectedDriverId);
  }, [performanceData, selectedDriverId]);

  // Calculate totals
  const totals = useMemo(() => {
    if (!Array.isArray(filteredData) || filteredData.length === 0) {
      return { completed: 0, failed: 0, fees: 0, avgTime: 0, avgRating: 0 };
    }
    return filteredData.reduce(
      (acc, driver) => ({
        completed: acc.completed + (driver.orders_completed || 0),
        failed: acc.failed + (driver.orders_failed || 0),
        fees: acc.fees + (driver.total_delivery_fees || 0),
        avgTime: acc.avgTime + (driver.average_delivery_time_minutes || 0),
        avgRating: acc.avgRating + (driver.customer_ratings_average || 0),
      }),
      { completed: 0, failed: 0, fees: 0, avgTime: 0, avgRating: 0 }
    );
  }, [filteredData]);

  const exportData = () => {
    const csvData = filteredData.map(driver => ({
      Driver: driver.driver_name,
      'Orders Completed': driver.orders_completed,
      'Orders Failed': driver.orders_failed,
      'Success Rate': driver.orders_completed + driver.orders_failed > 0 
        ? `${((driver.orders_completed / (driver.orders_completed + driver.orders_failed)) * 100).toFixed(1)}%`
        : '0%',
      'Total Fees': `₦${driver.total_delivery_fees.toLocaleString()}`,
      'Avg Delivery Time': `${driver.average_delivery_time_minutes.toFixed(1)} min`,
      'Avg Rating': driver.customer_ratings_average.toFixed(1),
      'Week Period': `${driver.week_start_date} to ${driver.week_end_date}`,
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-performance-${format(weekStart, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Top-level outline for the page
  return (
    <div className="border-2 border-black rounded-lg p-6 bg-white space-y-6 shadow-lg">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Driver Performance</h2>
          <p className="text-muted-foreground">
            Week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={selectedWeek.toString()} onValueChange={(value) => setSelectedWeek(parseInt(value))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">This Week</SelectItem>
              <SelectItem value="-1">Last Week</SelectItem>
              <SelectItem value="-2">2 Weeks Ago</SelectItem>
              <SelectItem value="-3">3 Weeks Ago</SelectItem>
              <SelectItem value="-4">4 Weeks Ago</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drivers</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 text-green-600 rounded-lg">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{totals.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 text-orange-600 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Fees</p>
                <p className="text-2xl font-bold">₦{totals.fees.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Time</p>
                <p className="text-2xl font-bold">
                  {filteredData.length > 0 ? Math.round(totals.avgTime / filteredData.length) : 0}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-600 rounded-lg">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">
                  {filteredData.length > 0 ? (totals.avgRating / filteredData.length).toFixed(1) : '0.0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error handling */}
      {error && (
        <Card className="border border-red-600 mb-6">
          <CardContent className="p-4 text-red-700">
            <strong>Error:</strong> Could not fetch driver performance. Please check your connection or try again.
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Driver Performance Table */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Driver Performance Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Blank table if no data */}
            <div className="overflow-x-auto">
              <table className="w-full border border-black">
                <thead>
                  <tr className="border-b bg-black text-white">
                    <th className="text-left p-3">Driver</th>
                    <th className="text-left p-3">Completed</th>
                    <th className="text-left p-3">Failed</th>
                    <th className="text-left p-3">Success Rate</th>
                    <th className="text-left p-3">Total Fees</th>
                    <th className="text-left p-3">Avg Time</th>
                    <th className="text-left p-3">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {(filteredData.length === 0) ? (
                    // blank table row
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No delivery data found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((driver) => {
                      const totalOrders = driver.orders_completed + driver.orders_failed;
                      const successRate = totalOrders > 0 ? (driver.orders_completed / totalOrders) * 100 : 0;
                      
                      return (
                        <tr key={driver.driver_id} className="border-b hover:bg-muted/30">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{driver.driver_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {drivers.find(d => d.id === driver.driver_id)?.vehicle_type || 'Unknown'}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              {driver.orders_completed}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="bg-red-50 text-red-700">
                              {driver.orders_failed}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-12 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full" 
                                  style={{ width: `${Math.min(successRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium">{successRate.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="p-3 font-medium">
                            ₦{driver.total_delivery_fees.toLocaleString()}
                          </td>
                          <td className="p-3">
                            {driver.average_delivery_time_minutes.toFixed(1)}m
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500" />
                              <span>{driver.customer_ratings_average.toFixed(1)}</span>
                              <span className="text-xs text-muted-foreground">
                                ({driver.total_customer_ratings})
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

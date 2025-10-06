import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Package } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import { useDriverRevenue, useDriverOrders } from '@/hooks/useAdvancedReports';
import { Badge } from '@/components/ui/badge';

interface DeliveryFeesTableProps {
  startDate: Date;
  endDate: Date;
  interval: 'day' | 'week' | 'month';
}

export function DeliveryFeesTable({ startDate, endDate, interval }: DeliveryFeesTableProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  const { data: driverRevenue, isLoading: driversLoading } = useDriverRevenue(startDate, endDate, interval);
  const { data: driverOrders, isLoading: ordersLoading } = useDriverOrders(selectedDriverId, startDate, endDate);

  // Get unique drivers from driver revenue data
  const uniqueDrivers = driverRevenue?.reduce((acc, curr) => {
    if (!acc.find(d => d.driver_id === curr.driver_id)) {
      acc.push({ driver_id: curr.driver_id, driver_name: curr.driver_name });
    }
    return acc;
  }, [] as Array<{ driver_id: string; driver_name: string }>);

  const handleExport = () => {
    if (!driverOrders || driverOrders.length === 0) return;
    const exportData = driverOrders.map(order => ({
      'Order Number': order.order_number,
      Date: format(parseISO(order.order_date), 'MMM d, yyyy HH:mm'),
      Customer: order.customer_name,
      'Delivery Fee (₦)': order.delivery_fee.toLocaleString(),
      Status: order.status,
    }));
    exportToCSV(exportData, `delivery-fees-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  if (driversLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Delivery Fees & Orders</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={selectedDriverId || ''} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {uniqueDrivers?.map(driver => (
                  <SelectItem key={driver.driver_id} value={driver.driver_id}>
                    {driver.driver_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!driverOrders || driverOrders.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedDriverId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a driver to view their delivery orders and fees
          </div>
        ) : ordersLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !driverOrders || driverOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No delivery orders found for this driver
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{driverOrders.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Fees</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₦{driverOrders.reduce((sum, o) => sum + Number(o.delivery_fee), 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Fee</p>
                  <p className="text-2xl font-bold">
                    ₦{(driverOrders.reduce((sum, o) => sum + Number(o.delivery_fee), 0) / driverOrders.length).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Delivery Fee</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverOrders.map((order) => (
                    <TableRow key={order.order_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {order.order_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(parseISO(order.order_date), 'MMM d, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell className="text-right text-blue-600 font-semibold">
                        ₦{Number(order.delivery_fee).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
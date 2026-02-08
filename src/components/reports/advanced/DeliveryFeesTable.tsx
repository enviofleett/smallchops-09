import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Download, Package, Check, ChevronsUpDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import { useDriverOrders } from '@/hooks/useAdvancedReports';
import { ZoneFeeBreakdown, DriverRevenue } from '@/types/dashboard';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DeliveryFeesTableProps {
  startDate: Date;
  endDate: Date;
  interval: 'day' | 'week' | 'month';
  zoneBreakdown?: ZoneFeeBreakdown[];
  driverRevenue?: DriverRevenue[];
  isLoading?: boolean;
}

export function DeliveryFeesTable({ 
  startDate, 
  endDate, 
  interval,
  zoneBreakdown,
  driverRevenue,
  isLoading
}: DeliveryFeesTableProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: driverOrders, isLoading: ordersLoading } = useDriverOrders(selectedDriverId, startDate, endDate);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Get unique drivers from driver revenue data
  const uniqueDrivers = driverRevenue?.reduce((acc, curr) => {
    if (!acc.find(d => d.driver_id === curr.driver_id)) {
      acc.push({ driver_id: curr.driver_id, driver_name: curr.driver_name });
    }
    return acc;
  }, [] as Array<{ driver_id: string; driver_name: string }>);

  // Filter drivers based on search query
  const filteredDrivers = uniqueDrivers?.filter(driver =>
    driver.driver_name.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const selectedDriver = uniqueDrivers?.find(d => d.driver_id === selectedDriverId);

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

  if (isLoading) {
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
        <CardTitle>Delivery Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="drivers">
          <TabsList className="mb-4">
            <TabsTrigger value="drivers">Driver Fees</TabsTrigger>
            <TabsTrigger value="zones">Zone Fees</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h3 className="text-lg font-medium">Driver Fees Breakdown</h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full sm:w-64 justify-between"
                    >
                      {selectedDriver ? selectedDriver.driver_name : "Select a driver"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full sm:w-64 p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search drivers..." 
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                      />
                      <CommandList>
                        <CommandEmpty>No driver found.</CommandEmpty>
                        <CommandGroup>
                          {filteredDrivers?.map((driver) => (
                            <CommandItem
                              key={driver.driver_id}
                              value={driver.driver_name}
                              onSelect={() => {
                                setSelectedDriverId(driver.driver_id === selectedDriverId ? null : driver.driver_id);
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedDriverId === driver.driver_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {driver.driver_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                <Button variant="outline" size="icon" onClick={handleExport} disabled={!driverOrders || driverOrders.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!selectedDriverId ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a driver to view detailed fee breakdown</p>
              </div>
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
                        <TableHead>Fee</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {driverOrders.map((order) => (
                        <TableRow key={order.order_id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{format(parseISO(order.order_date), 'MMM d, HH:mm')}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell>₦{order.delivery_fee.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="zones">
            <h3 className="text-lg font-medium mb-4">Zone Fees Breakdown</h3>
            {!zoneBreakdown || zoneBreakdown.length === 0 ? (
               <div className="text-center py-12 text-muted-foreground">
                 No zone data available for this period.
               </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone Name</TableHead>
                    <TableHead className="text-right">Total Orders</TableHead>
                    <TableHead className="text-right">Total Fees</TableHead>
                    <TableHead className="text-right">Avg Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zoneBreakdown.map((zone) => (
                    <TableRow key={zone.zone_id}>
                      <TableCell className="font-medium">{zone.zone_name}</TableCell>
                      <TableCell className="text-right">{zone.total_orders}</TableCell>
                      <TableCell className="text-right">₦{zone.total_fees.toLocaleString()}</TableCell>
                      <TableCell className="text-right">₦{zone.average_fee.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

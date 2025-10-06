import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import { supabase } from '@/integrations/supabase/client';
import type { DailyRevenueReport } from '@/api/advancedReports';

interface RevenueTableProps {
  data?: DailyRevenueReport[];
  isLoading?: boolean;
}

export function RevenueTable({ data, isLoading }: RevenueTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [orderDetails, setOrderDetails] = useState<Record<string, any[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<Set<string>>(new Set());

  const toggleRow = async (date: string) => {
    const newExpanded = new Set(expandedRows);
    
    if (expandedRows.has(date)) {
      newExpanded.delete(date);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(date);
      setExpandedRows(newExpanded);
      
      // Fetch orders for this date if not already loaded
      if (!orderDetails[date]) {
        setLoadingOrders(prev => new Set(prev).add(date));
        try {
          const startOfDay = new Date(`${date}T00:00:00`);
          const endOfDay = new Date(`${date}T23:59:59.999`);
          
          const { data: orders, error } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, total_amount, status, payment_status, created_at')
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())
            .in('payment_status', ['paid', 'completed'])
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          
          setOrderDetails(prev => ({ ...prev, [date]: orders || [] }));
        } catch (error) {
          console.error('Error fetching orders:', error);
          setOrderDetails(prev => ({ ...prev, [date]: [] }));
        } finally {
          setLoadingOrders(prev => {
            const newSet = new Set(prev);
            newSet.delete(date);
            return newSet;
          });
        }
      }
    }
  };

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const exportData = data.map(row => ({
      Date: row.date,
      'Total Revenue (₦)': row.total_revenue.toLocaleString(),
      'Total Orders': row.total_orders,
      'Avg Order Value (₦)': row.avg_order_value.toFixed(2),
    }));
    exportToCSV(exportData, `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daily Revenue Report</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No revenue data available for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Orders</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Avg Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <React.Fragment key={index}>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(row.date)}
                    >
                      <TableCell>
                        {expandedRows.has(row.date) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {format(parseISO(row.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        ₦{row.total_revenue.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {row.total_orders}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        ₦{row.avg_order_value.toFixed(2)}
                      </TableCell>
                    </TableRow>
                    
                    {expandedRows.has(row.date) && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30 p-0">
                          {loadingOrders.has(row.date) ? (
                            <div className="p-4">
                              <Skeleton className="h-20 w-full" />
                            </div>
                          ) : orderDetails[row.date]?.length > 0 ? (
                            <div className="p-4 space-y-2">
                              {orderDetails[row.date].map((order) => (
                                <div 
                                  key={order.id} 
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-background rounded-lg border"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{order.order_number}</p>
                                    <p className="text-sm text-muted-foreground truncate">{order.customer_name}</p>
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                                      {order.status}
                                    </Badge>
                                    <span className="font-semibold text-green-600">
                                      ₦{order.total_amount.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                              No orders found for this date
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
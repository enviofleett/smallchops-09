import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import type { DailyRevenueReport } from '@/api/advancedReports';

interface RevenueTableProps {
  data?: DailyRevenueReport[];
  isLoading?: boolean;
}

export function RevenueTable({ data, isLoading }: RevenueTableProps) {
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
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Avg Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {format(parseISO(row.date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      ₦{row.total_revenue.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.total_orders}
                    </TableCell>
                    <TableCell className="text-right">
                      ₦{row.avg_order_value.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
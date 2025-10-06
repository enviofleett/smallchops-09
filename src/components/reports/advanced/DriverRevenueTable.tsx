import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import type { DriverRevenueReport } from '@/api/advancedReports';

interface DriverRevenueTableProps {
  data?: DriverRevenueReport[];
  isLoading?: boolean;
}

export function DriverRevenueTable({ data, isLoading }: DriverRevenueTableProps) {
  const handleExport = () => {
    if (!data || data.length === 0) return;
    const exportData = data.map(row => ({
      Interval: format(parseISO(row.interval_start), 'MMM d, yyyy'),
      Driver: row.driver_name,
      'Total Deliveries': row.total_deliveries,
      'Total Revenue (₦)': row.total_revenue.toLocaleString(),
      'Delivery Fees (₦)': row.total_delivery_fees.toLocaleString(),
      'Avg Fee (₦)': row.avg_delivery_fee.toFixed(2),
    }));
    exportToCSV(exportData, `driver-revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
        <CardTitle>Driver Revenue Report</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No driver revenue data available for the selected period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Interval</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead className="text-right">Deliveries</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">Delivery Fees</TableHead>
                  <TableHead className="text-right">Avg Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {format(parseISO(row.interval_start), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{row.driver_name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {Number(row.total_deliveries)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ₦{Number(row.total_revenue).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ₦{Number(row.total_delivery_fees).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ₦{Number(row.avg_delivery_fee).toFixed(2)}
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
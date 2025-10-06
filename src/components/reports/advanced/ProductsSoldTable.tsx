import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { exportToCSV } from '@/api/advancedReports';
import type { ProductsSoldReport } from '@/api/advancedReports';

interface ProductsSoldTableProps {
  data?: ProductsSoldReport[];
  isLoading?: boolean;
}

export function ProductsSoldTable({ data, isLoading }: ProductsSoldTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;
    const exportData = filteredData.map(row => ({
      Interval: format(parseISO(row.interval_start), 'MMM d, yyyy'),
      Product: row.product_name,
      'Units Sold': row.units_sold,
      'Revenue (₦)': row.total_revenue.toLocaleString(),
      'Avg Price (₦)': row.avg_price.toFixed(2),
    }));
    exportToCSV(exportData, `products-sold-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const filteredData = data?.filter(item =>
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Identify top sellers (top 10% by units sold)
  const topThreshold = data && data.length > 0
    ? data.sort((a, b) => Number(b.units_sold) - Number(a.units_sold))[Math.floor(data.length * 0.1)]?.units_sold || 0
    : 0;

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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Products Sold Report</CardTitle>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-full sm:w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!filteredData || filteredData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No products match your search' : 'No product sales data available'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Interval</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row, index) => {
                  const isTopSeller = Number(row.units_sold) >= topThreshold && topThreshold > 0;
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {format(parseISO(row.interval_start), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {row.product_name}
                          {isTopSeller && (
                            <Badge variant="default" className="gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Top Seller
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(row.units_sold).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ₦{Number(row.total_revenue).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ₦{Number(row.avg_price).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
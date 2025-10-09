import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllProducts, useProductTrends } from '@/hooks/useAdvancedReports';

interface ProductTrendsChartProps {
  startDate: Date;
  endDate: Date;
  interval: 'day' | 'week' | 'month';
}

export function ProductTrendsChart({ startDate, endDate, interval }: ProductTrendsChartProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  
  const { data: allProducts, isLoading: productsLoading } = useAllProducts();
  const { data: trendsData, isLoading: trendsLoading } = useProductTrends(
    selectedProductId,
    startDate,
    endDate,
    interval
  );

  const selectedProduct = allProducts?.find(p => p.id === selectedProductId);

  const chartData = trendsData?.map(item => ({
    date: format(parseISO(item.interval_start), 'MMM d'),
    units: Number(item.units_sold),
    revenue: Number(item.revenue),
    orders: Number(item.orders_count),
  })) || [];

  if (productsLoading) {
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
          <CardTitle>Product Sales Trends</CardTitle>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full sm:w-64 justify-between"
              >
                {selectedProduct ? selectedProduct.name : "Select a product..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full sm:w-64 p-0">
              <Command>
                <CommandInput placeholder="Search products..." />
                <CommandList>
                  <CommandEmpty>No product found.</CommandEmpty>
                  <CommandGroup>
                    {allProducts?.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.name}
                        onSelect={() => {
                          setSelectedProductId(product.id === selectedProductId ? null : product.id);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {product.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedProductId ? (
          <div className="text-center py-12 text-muted-foreground">
            Select a product to view sales trends
          </div>
        ) : trendsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No trend data available for this product
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: 'Units Sold', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))' }}
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right"
                label={{ value: 'Revenue (₦)', angle: 90, position: 'insideRight', fill: 'hsl(var(--foreground))' }}
                tick={{ fill: 'hsl(var(--foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'Revenue (₦)') return [`₦${Number(value).toLocaleString()}`, name];
                  return [Number(value).toLocaleString(), name];
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar
                yAxisId="left"
                dataKey="units"
                fill="hsl(var(--primary))"
                name="Units Sold"
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />
              <Bar
                yAxisId="right"
                dataKey="revenue"
                fill="hsl(var(--chart-2))"
                name="Revenue (₦)"
                radius={[4, 4, 0, 0]}
                maxBarSize={60}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
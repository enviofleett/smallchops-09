import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UrgentDeliveryFilter } from './UrgentDeliveryFilter';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  X,
  RefreshCw,
  Download
} from 'lucide-react';
import { format, isToday, isYesterday, startOfDay, endOfDay } from 'date-fns';

interface DeliveryFiltersProps {
  orders: any[];
  onFilterChange: (filteredOrders: any[]) => void;
  onRefresh?: () => void;
  onExport?: () => void;
}

export function DeliveryFilters({ 
  orders, 
  onFilterChange, 
  onRefresh,
  onExport 
}: DeliveryFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [urgentFilter, setUrgentFilter] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Apply all filters
  const applyFilters = (
    query = searchQuery,
    status = statusFilter,
    date = dateFilter,
    urgent = urgentFilter
  ) => {
    let filtered = [...orders];
    const active: string[] = [];

    // Search filter
    if (query.trim()) {
      filtered = filtered.filter(order =>
        order.order_number?.toLowerCase().includes(query.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(query.toLowerCase()) ||
        order.customer_email?.toLowerCase().includes(query.toLowerCase())
      );
      active.push('search');
    }

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter(order => order.status === status);
      active.push('status');
    }

    // Date filter
    if (date) {
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.order_time);
        return orderDate >= startDate && orderDate <= endDate;
      });
      active.push('date');
    }

    // Urgent filter (handled separately by UrgentDeliveryFilter component)
    if (urgent) {
      active.push('urgent');
    }

    setActiveFilters(active);
    onFilterChange(filtered);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    applyFilters(value, statusFilter, dateFilter, urgentFilter);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    applyFilters(searchQuery, value, dateFilter, urgentFilter);
  };

  const handleDateChange = (date: Date | undefined) => {
    setDateFilter(date);
    applyFilters(searchQuery, statusFilter, date, urgentFilter);
  };

  const handleUrgentToggle = () => {
    const newUrgent = !urgentFilter;
    setUrgentFilter(newUrgent);
    applyFilters(searchQuery, statusFilter, dateFilter, newUrgent);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter(undefined);
    setUrgentFilter(false);
    setActiveFilters([]);
    onFilterChange(orders);
  };

  const getDateDisplayText = (date: Date | undefined) => {
    if (!date) return 'Select date';
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  // Get order counts by status
  const statusCounts = {
    all: orders.length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Main Filters Row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search orders, customers..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status ({statusCounts.all})</SelectItem>
                <SelectItem value="confirmed">Confirmed ({statusCounts.confirmed})</SelectItem>
                <SelectItem value="preparing">Preparing ({statusCounts.preparing})</SelectItem>
                <SelectItem value="ready">Ready ({statusCounts.ready})</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery ({statusCounts.out_for_delivery})</SelectItem>
                <SelectItem value="delivered">Delivered ({statusCounts.delivered})</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !dateFilter && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {getDateDisplayText(dateFilter)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFilter}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Secondary Filters Row */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            {/* Urgent Filter */}
            <UrgentDeliveryFilter
              orders={orders}
              onFilterChange={onFilterChange}
              isActive={urgentFilter}
              onToggle={handleUrgentToggle}
            />

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              )}
              
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              )}

              {activeFilters.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {activeFilters.includes('search') && (
                <Badge variant="secondary" className="text-xs">
                  Search: "{searchQuery}"
                </Badge>
              )}
              {activeFilters.includes('status') && statusFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Status: {statusFilter.replace('_', ' ')}
                </Badge>
              )}
              {activeFilters.includes('date') && dateFilter && (
                <Badge variant="secondary" className="text-xs">
                  Date: {getDateDisplayText(dateFilter)}
                </Badge>
              )}
              {activeFilters.includes('urgent') && (
                <Badge variant="destructive" className="text-xs">
                  Urgent Only
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
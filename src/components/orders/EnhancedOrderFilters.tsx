import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon, Filter, X, Search, Download } from 'lucide-react';
import { OrderStatus, PaymentStatus } from '@/types/orders';

interface OrderFilters {
  status?: OrderStatus | 'all';
  paymentStatus?: PaymentStatus | 'all';
  orderType?: 'delivery' | 'pickup' | 'all';
  searchQuery?: string;
  dateFrom?: Date;
  dateTo?: Date;
  assignedRider?: string | 'all';
  orderNumber?: string;
}

interface EnhancedOrderFiltersProps {
  filters: OrderFilters;
  onFiltersChange: (filters: OrderFilters) => void;
  totalCount?: number;
  filteredCount?: number;
  onExport?: () => void;
}

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'all'; label: string; color: string }> = [
  { value: 'all', label: 'All Statuses', color: 'bg-gray-100 text-gray-700' },
  { value: 'pending', label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-100 text-blue-700' },
  { value: 'preparing', label: 'Preparing', color: 'bg-orange-100 text-orange-700' },
  { value: 'ready', label: 'Ready', color: 'bg-purple-100 text-purple-700' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-700' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  { value: 'returned', label: 'Returned', color: 'bg-yellow-100 text-yellow-800' }
];

const PAYMENT_STATUS_OPTIONS: Array<{ value: PaymentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Payment Statuses' },
  { value: 'pending', label: 'Payment Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Payment Failed' },
  { value: 'refunded', label: 'Refunded' }
];

const ORDER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Order Types' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Pickup' }
];

const DATE_PRESETS = [
  { label: 'Today', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Yesterday', getValue: () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return { from: yesterday, to: yesterday };
  }},
  { label: 'Last 7 Days', getValue: () => {
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return { from, to: new Date() };
  }},
  { label: 'Last 30 Days', getValue: () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to: new Date() };
  }},
  { label: 'This Month', getValue: () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: new Date() };
  }}
];

export const EnhancedOrderFilters: React.FC<EnhancedOrderFiltersProps> = ({
  filters,
  onFiltersChange,
  totalCount = 0,
  filteredCount = 0,
  onExport
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  // Auto-expand if filters are active
  useEffect(() => {
    const hasActiveFilters = 
      (filters.status && filters.status !== 'all') ||
      (filters.paymentStatus && filters.paymentStatus !== 'all') ||
      (filters.orderType && filters.orderType !== 'all') ||
      filters.searchQuery ||
      filters.dateFrom ||
      filters.dateTo;
    
    if (hasActiveFilters) {
      setIsExpanded(true);
    }
  }, [filters]);

  const updateFilter = (key: keyof OrderFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      status: 'all',
      paymentStatus: 'all',
      orderType: 'all',
      searchQuery: '',
      dateFrom: undefined,
      dateTo: undefined,
      assignedRider: 'all',
      orderNumber: ''
    });
  };

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const { from, to } = preset.getValue();
    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.paymentStatus && filters.paymentStatus !== 'all') count++;
    if (filters.orderType && filters.orderType !== 'all') count++;
    if (filters.searchQuery) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Order Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <Badge variant="outline">
                {filteredCount} of {totalCount} orders
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Search - Always Visible */}
        <div className="flex gap-2">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name, email, phone, or order number..."
                value={filters.searchQuery || ''}
                onChange={(e) => updateFilter('searchQuery', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="icon" onClick={clearAllFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Status Quick Filters - Always Visible */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.slice(0, 6).map((option) => (
            <Button
              key={option.value}
              variant={filters.status === option.value ? "default" : "outline"}
              size="sm"
              className={filters.status === option.value ? "" : "hover:bg-accent"}
              onClick={() => updateFilter('status', option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Expanded Filters */}
        {isExpanded && (
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Order Status */}
              <div className="space-y-2">
                <Label>Order Status</Label>
                <Select 
                  value={filters.status || 'all'} 
                  onValueChange={(value) => updateFilter('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Status */}
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select 
                  value={filters.paymentStatus || 'all'} 
                  onValueChange={(value) => updateFilter('paymentStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Type */}
              <div className="space-y-2">
                <Label>Order Type</Label>
                <Select 
                  value={filters.orderType || 'all'} 
                  onValueChange={(value) => updateFilter('orderType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order Number */}
              <div className="space-y-2">
                <Label>Order Number</Label>
                <Input
                  placeholder="e.g., ORD-2024-001"
                  value={filters.orderNumber || ''}
                  onChange={(e) => updateFilter('orderNumber', e.target.value)}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-3">
              <Label>Date Range</Label>
              <div className="flex flex-wrap gap-2 mb-3">
                {DATE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyDatePreset(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateFrom ? format(filters.dateFrom, 'PPP') : 'From date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => {
                          updateFilter('dateFrom', date);
                          setDateFromOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1">
                  <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateTo ? format(filters.dateTo, 'PPP') : 'To date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => {
                          updateFilter('dateTo', date);
                          setDateToOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Active Filters Summary */}
            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Label className="text-sm text-muted-foreground">Active filters:</Label>
                {filters.status && filters.status !== 'all' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Status: {STATUS_OPTIONS.find(o => o.value === filters.status)?.label}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => updateFilter('status', 'all')}
                    />
                  </Badge>
                )}
                {filters.paymentStatus && filters.paymentStatus !== 'all' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Payment: {PAYMENT_STATUS_OPTIONS.find(o => o.value === filters.paymentStatus)?.label}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => updateFilter('paymentStatus', 'all')}
                    />
                  </Badge>
                )}
                {filters.searchQuery && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Search: "{filters.searchQuery}"
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => updateFilter('searchQuery', '')}
                    />
                  </Badge>
                )}
                {(filters.dateFrom || filters.dateTo) && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Date: {filters.dateFrom ? format(filters.dateFrom, 'MMM d') : 'Any'} - {filters.dateTo ? format(filters.dateTo, 'MMM d') : 'Any'}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => {
                        updateFilter('dateFrom', undefined);
                        updateFilter('dateTo', undefined);
                      }}
                    />
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
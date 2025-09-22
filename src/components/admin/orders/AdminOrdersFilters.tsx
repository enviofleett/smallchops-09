import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Filter, X, RotateCcw } from 'lucide-react';
import { OrderStatus } from '@/types/orders'; 
import { HourlyDeliveryFilter } from './HourlyDeliveryFilter';
import { OrderTabDropdown } from './OrderTabDropdown';

interface AdminOrdersFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | OrderStatus;
  setStatusFilter: (filter: 'all' | OrderStatus) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDay: 'today' | 'tomorrow' | null;
  setSelectedDay: (day: 'today' | 'tomorrow' | null) => void;
  selectedHour: string | null;
  setSelectedHour: (hour: string | null) => void;
  isMobile: boolean;
  refetch: () => void;
  orders: any[];
  filteredOrdersCount?: number;
}

export function AdminOrdersFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  activeTab,
  setActiveTab,
  selectedDay,
  setSelectedDay,
  selectedHour,
  setSelectedHour,
  isMobile,
  refetch,
  orders,
  filteredOrdersCount
}: AdminOrdersFiltersProps) {
  
  // Calculate if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery.length > 0 || 
           statusFilter !== 'all' || 
           selectedDay !== null ||
           selectedHour !== null;
  }, [searchQuery, statusFilter, selectedDay, selectedHour]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSelectedDay(null);
    setSelectedHour(null);
  };


  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search orders by ID, customer name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          
          {/* Status Filter */}
          <div className="relative">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="ml-2">
                    Active
                  </Badge>
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearAllFilters}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{searchQuery}"
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSearchQuery('')}
              />
            </Badge>
          )}
          
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusFilter}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setStatusFilter('all')}
              />
            </Badge>
          )}
          
          
          {selectedDay && (
            <Badge variant="secondary" className="gap-1">
              Day: {selectedDay}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedDay(null)}
              />
            </Badge>
          )}
          
          {selectedHour && (
            <Badge variant="secondary" className="gap-1">
              Hour: {selectedHour}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedHour(null)}
              />
            </Badge>
          )}
        </div>
      )}


      {/* Order Tabs */}
      <OrderTabDropdown
        activeTab={activeTab}
        onTabChange={setActiveTab}
        orderCounts={{
          all: orders.length,
          confirmed: orders.filter(o => o.status === 'confirmed').length,
          preparing: orders.filter(o => o.status === 'preparing').length,
          ready: orders.filter(o => o.status === 'ready').length,
          out_for_delivery: orders.filter(o => o.status === 'out_for_delivery').length,
          delivered: orders.filter(o => o.status === 'delivered').length
        }}
      />

      {/* Hourly Delivery Filter for Confirmed Tab */}
      {activeTab === 'confirmed' && (
        <HourlyDeliveryFilter
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          selectedHour={selectedHour}
          onHourChange={setSelectedHour}
        />
      )}
    </div>
  );
}
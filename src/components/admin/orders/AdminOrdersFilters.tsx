import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Filter } from 'lucide-react';
import { OrderStatus } from '@/types/orders';
import { DeliveryFilterType } from '@/utils/dateFilterUtils';
import { HourlyDeliveryFilter } from './HourlyDeliveryFilter';
import { DeliveryDateFilter } from './DeliveryDateFilter';
import { OrderTabDropdown } from './OrderTabDropdown';
import { OverdueDateFilter } from './OverdueDateFilter';
import { isOrderOverdue } from '@/utils/scheduleTime';

interface AdminOrdersFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: 'all' | OrderStatus | 'overdue';
  setStatusFilter: (filter: 'all' | OrderStatus | 'overdue') => void;
  deliveryFilter: DeliveryFilterType;
  setDeliveryFilter: (filter: DeliveryFilterType) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedDay: 'today' | 'tomorrow' | null;
  setSelectedDay: (day: 'today' | 'tomorrow' | null) => void;
  selectedHour: string | null;
  setSelectedHour: (hour: string | null) => void;
  selectedOverdueDateFilter: string | null;
  setSelectedOverdueDateFilter: (filter: string | null) => void;
  isMobile: boolean;
  refetch: () => void;
  orders: any[];
  deliverySchedules: Record<string, any>;
}

export function AdminOrdersFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  deliveryFilter,
  setDeliveryFilter,
  activeTab,
  setActiveTab,
  selectedDay,
  setSelectedDay,
  selectedHour,
  setSelectedHour,
  selectedOverdueDateFilter,
  setSelectedOverdueDateFilter,
  isMobile,
  refetch,
  orders,
  deliverySchedules
}: AdminOrdersFiltersProps) {
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
          </div>
          
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
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

      {/* Delivery Date Filter */}
      {statusFilter !== 'overdue' && (
        <DeliveryDateFilter 
          value={deliveryFilter}
          onChange={setDeliveryFilter}
        />
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
          delivered: orders.filter(o => o.status === 'delivered').length,
          overdue: orders.filter(o => {
            const schedule = deliverySchedules[o.id];
            return schedule && isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end);
          }).length
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

      {/* Overdue Date Filter for Overdue Tab */}
      {activeTab === 'overdue' && (
        <OverdueDateFilter
          selectedDateFilter={selectedOverdueDateFilter}
          onDateFilterChange={setSelectedOverdueDateFilter}
          overdueOrderCounts={{
            today: 0,
            yesterday: 0,
            lastWeek: 0,
            older: 0
          }}
        />
      )}
    </div>
  );
}
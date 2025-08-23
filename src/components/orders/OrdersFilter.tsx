
import React, { useState } from 'react';
import { Search, Filter, ChevronDown, Calendar, X } from 'lucide-react';
import { OrderStatus } from '@/types/orders';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OrdersFilterProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  onSearch: (query: string) => void;
  startDate?: Date;
  endDate?: Date;
  onDateRangeChange: (startDate?: Date, endDate?: Date) => void;
  overdueFilter?: boolean;
  onOverdueChange?: (overdue: boolean) => void;
}

const statusOptions: { value: OrderStatus | 'all' | 'overdue'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'overdue', label: 'Overdue Deliveries' },
];


const OrdersFilter = ({ statusFilter, onStatusChange, onSearch, startDate, endDate, onDateRangeChange, overdueFilter, onOverdueChange }: OrdersFilterProps) => {
  const [showFilters, setShowFilters] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const hasDateFilter = startDate || endDate;

  const clearDateFilter = () => {
    onDateRangeChange(undefined, undefined);
  };

  return (
    <div className="bg-background rounded-2xl shadow-sm border border-border p-4 md:p-6 space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 lg:space-x-4">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          <input
            type="text"
            placeholder="Search by order number, customer name, email, or phone..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="appearance-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto min-w-[140px]"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          
          {/* More filters toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center space-x-2 min-h-[42px]",
              (showFilters || hasDateFilter) && "bg-primary/10 border-primary/20"
            )}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Date Filters</span>
            <span className="sm:hidden">Dates</span>
            {hasDateFilter && (
              <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                {startDate && endDate ? '2' : '1'}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="border-t border-border pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end space-y-3 sm:space-y-0 sm:space-x-4">
            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">From Date</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[200px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      onDateRangeChange(date, endDate);
                      setStartDateOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">To Date</label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[200px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      onDateRangeChange(startDate, date);
                      setEndDateOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear filters */}
            {hasDateFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilter}
                className="flex items-center space-x-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                <span>Clear dates</span>
              </Button>
            )}
          </div>

          {/* Active filters summary */}
          {hasDateFilter && (
            <div className="mt-3 flex flex-wrap gap-2">
              {startDate && (
                <div className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
                  <span>From: {format(startDate, "MMM dd, yyyy")}</span>
                </div>
              )}
              {endDate && (
                <div className="inline-flex items-center space-x-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-xs">
                  <span>To: {format(endDate, "MMM dd, yyyy")}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersFilter;

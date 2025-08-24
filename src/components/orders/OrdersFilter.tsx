
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
    <div className="bg-background rounded-lg md:rounded-2xl shadow-sm border border-border p-3 md:p-6 space-y-3 md:space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col space-y-3 lg:flex-row lg:items-center lg:justify-between lg:space-y-0 lg:space-x-4">
        {/* Search */}
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 md:h-5 md:w-5" />
          <input
            type="text"
            placeholder="Search orders..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 md:pl-10 pr-4 py-2 md:py-2.5 text-sm md:text-base bg-muted/50 border border-border rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
          />
        </div>

        {/* Filter controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 md:space-x-3">
          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="appearance-none bg-muted/50 border border-border rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-2.5 pr-7 md:pr-8 focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto min-w-[120px] md:min-w-[140px] text-sm md:text-base"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 text-muted-foreground pointer-events-none" />
          </div>
          
          {/* More filters toggle */}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            size="sm"
            className={cn(
              "flex items-center space-x-1 md:space-x-2 min-h-[36px] md:min-h-[42px] text-xs md:text-sm px-2 md:px-3",
              (showFilters || hasDateFilter) && "bg-primary/10 border-primary/20"
            )}
          >
            <Filter className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden xs:inline">Date Filters</span>
            <span className="xs:hidden">Dates</span>
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
        <div className="border-t border-border pt-3 md:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-end space-y-2 md:space-y-3 sm:space-y-0 sm:space-x-3 md:space-x-4">
            {/* Start Date */}
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-medium text-foreground">From Date</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full sm:w-[160px] md:w-[200px] justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {startDate ? format(startDate, "MMM dd") : "Pick start"}
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
            <div className="space-y-1 md:space-y-2">
              <label className="text-xs md:text-sm font-medium text-foreground">To Date</label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full sm:w-[160px] md:w-[200px] justify-start text-left font-normal text-xs md:text-sm h-8 md:h-10",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
                    {endDate ? format(endDate, "MMM dd") : "Pick end"}
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
                className="flex items-center space-x-1 text-muted-foreground hover:text-foreground h-8 md:h-10 text-xs md:text-sm px-2 md:px-3"
              >
                <X className="h-3 w-3 md:h-4 md:w-4" />
                <span>Clear</span>
              </Button>
            )}
          </div>

          {/* Active filters summary */}
          {hasDateFilter && (
            <div className="mt-2 md:mt-3 flex flex-wrap gap-1 md:gap-2">
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


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

const statusOptions: { value: OrderStatus | 'all' | 'overdue' | 'pending'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pend' },
    { value: 'confirmed', label: 'Conf' },
    { value: 'preparing', label: 'Prep' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Delivery' },
    { value: 'delivered', label: 'Done' },
    { value: 'cancelled', label: 'Cancel' },
    { value: 'overdue', label: 'Overdue' },
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
    <div className="bg-background rounded-lg shadow-sm border border-border p-2 md:p-3 space-y-2 md:space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3 md:h-4 md:w-4" />
        <input
          type="text"
          placeholder="Search..."
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-6 md:pl-8 pr-3 py-2 text-xs md:text-sm bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-colors"
        />
      </div>

      {/* Status tabs */}
      <div className="flex items-center justify-between gap-1 md:gap-2">
        <div className="flex overflow-x-auto scrollbar-hide gap-1 flex-1">
          {statusOptions.map(option => (
            <button
              key={option.value}
              onClick={() => onStatusChange(option.value)}
              className={cn(
                "flex-shrink-0 px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors",
                statusFilter === option.value 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {option.label}
              {option.value === 'pending' && statusFilter === 'pending' && (
                <span className="ml-1 text-xs">(2)</span>
              )}
            </button>
          ))}
        </div>
        
        {/* Date filter toggle */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          size="sm"
          className={cn(
            "flex-shrink-0 h-7 md:h-8 px-2 text-xs",
            (showFilters || hasDateFilter) && "bg-primary/10 border-primary/20"
          )}
        >
          <Filter className="h-3 w-3" />
          {hasDateFilter && (
            <span className="ml-1 bg-primary text-primary-foreground text-xs px-1 rounded-full">
              {startDate && endDate ? '2' : '1'}
            </span>
          )}
        </Button>
      </div>

      {/* Date filters */}
      {showFilters && (
        <div className="border-t border-border pt-2">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            {/* Start Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">From</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full sm:w-32 justify-start text-left font-normal text-xs h-7",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    {startDate ? format(startDate, "MMM dd") : "Start"}
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
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">To</label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full sm:w-32 justify-start text-left font-normal text-xs h-7",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-1 h-3 w-3" />
                    {endDate ? format(endDate, "MMM dd") : "End"}
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
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground h-7 text-xs px-2"
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filters */}
          {hasDateFilter && (
            <div className="mt-2 flex flex-wrap gap-1">
              {startDate && (
                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                  From: {format(startDate, "MMM dd")}
                </div>
              )}
              {endDate && (
                <div className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                  To: {format(endDate, "MMM dd")}
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

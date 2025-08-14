import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  Filter, 
  ChevronDown, 
  Calendar,
  Clock,
  Package,
  X
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

interface FilterBarProps {
  filters: {
    dateRange: string;
    customStartDate?: string;
    customEndDate?: string;
    status: string[];
    timeSlot?: string;
  };
  onFiltersChange: (filters: any) => void;
  totalCount: number;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'secondary' },
  { value: 'confirmed', label: 'Confirmed', color: 'secondary' },
  { value: 'preparing', label: 'Preparing', color: 'outline' },
  { value: 'ready', label: 'Ready', color: 'outline' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'default' },
  { value: 'delivered', label: 'Delivered', color: 'success' },
  { value: 'completed', label: 'Completed', color: 'success' },
];

const TIME_SLOT_OPTIONS = [
  { value: 'morning', label: 'Morning (6AM-12PM)' },
  { value: 'afternoon', label: 'Afternoon (12PM-6PM)' },
  { value: 'evening', label: 'Evening (6PM-12AM)' },
];

const DATE_RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'past_week', label: 'Past Week' },
  { value: 'custom', label: 'Custom Range' },
];

export function FilterBar({ filters, onFiltersChange, totalCount }: FilterBarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const handleStatusToggle = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    
    onFiltersChange({ ...filters, status: newStatus });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: 'today',
      status: [],
      timeSlot: undefined,
      customStartDate: undefined,
      customEndDate: undefined
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.timeSlot) count++;
    if (filters.dateRange !== 'today') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="space-y-4">
      {/* Mobile Filter Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="sm:hidden">
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          {/* Desktop Filters */}
          <div className="hidden sm:flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'order' : 'orders'}
          </span>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs h-8"
            >
              <X className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Filter Controls */}
      <div className="hidden sm:flex flex-wrap items-center gap-3">
        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={filters.dateRange} 
            onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
          >
            <SelectTrigger className="w-auto min-w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom Date Range */}
        {filters.dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => onFiltersChange({ 
                ...filters, 
                customStartDate: e.target.value 
              })}
              className="w-auto"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => onFiltersChange({ 
                ...filters, 
                customEndDate: e.target.value 
              })}
              className="w-auto"
            />
          </div>
        )}

        {/* Time Slot */}
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={filters.timeSlot || ''} 
            onValueChange={(value) => onFiltersChange({ 
              ...filters, 
              timeSlot: value || undefined 
            })}
          >
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue placeholder="All times" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All times</SelectItem>
              {TIME_SLOT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-muted-foreground" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Status
                {filters.status.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 text-xs">
                    {filters.status.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Order Status</h4>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={option.value}
                        checked={filters.status.includes(option.value)}
                        onChange={() => handleStatusToggle(option.value)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor={option.value} className="text-sm cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Mobile Filter Panel */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
        <CollapsibleContent className="sm:hidden">
          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date Range</Label>
              <Select 
                value={filters.dateRange} 
                onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {filters.dateRange === 'custom' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Custom Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={filters.customStartDate || ''}
                    onChange={(e) => onFiltersChange({ 
                      ...filters, 
                      customStartDate: e.target.value 
                    })}
                    placeholder="Start date"
                  />
                  <Input
                    type="date"
                    value={filters.customEndDate || ''}
                    onChange={(e) => onFiltersChange({ 
                      ...filters, 
                      customEndDate: e.target.value 
                    })}
                    placeholder="End date"
                  />
                </div>
              </div>
            )}

            {/* Time Slot */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Time Slot</Label>
              <Select 
                value={filters.timeSlot || ''} 
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  timeSlot: value || undefined 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All times" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All times</SelectItem>
                  {TIME_SLOT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Order Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map(option => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`mobile-${option.value}`}
                      checked={filters.status.includes(option.value)}
                      onChange={() => handleStatusToggle(option.value)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`mobile-${option.value}`} className="text-sm cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
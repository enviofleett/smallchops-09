import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, AlertTriangle, Filter, X } from 'lucide-react';

interface DeliveryFilters {
  dateRange: 'all' | 'today' | 'tomorrow' | 'this_week' | 'past_week';
  timeSlot: 'all' | 'morning' | 'afternoon' | 'evening';
  urgency: 'all' | 'urgent' | 'due_today' | 'upcoming';
}

interface EnhancedDeliveryFilterProps {
  filters: DeliveryFilters;
  onFiltersChange: (filters: DeliveryFilters) => void;
  onClearFilters: () => void;
  orderCounts?: {
    total: number;
    urgent: number;
    dueToday: number;
    upcoming: number;
  };
}

export const EnhancedDeliveryFilter: React.FC<EnhancedDeliveryFilterProps> = ({
  filters,
  onFiltersChange,
  onClearFilters,
  orderCounts = { total: 0, urgent: 0, dueToday: 0, upcoming: 0 }
}) => {
  const hasActiveFilters = filters.dateRange !== 'all' || filters.timeSlot !== 'all' || filters.urgency !== 'all';

  const updateFilter = (key: keyof DeliveryFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  return (
    <Card className="border-2 border-dashed border-muted-foreground/20">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Filter Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <h3 className="text-sm font-medium">Delivery Filters</h3>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  {Object.values(filters).filter(v => v !== 'all').length} active
                </Badge>
              )}
            </div>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium">Delivery Date</label>
              </div>
              <Select value={filters.dateRange} onValueChange={(value) => updateFilter('dateRange', value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">
                    <div className="flex items-center justify-between w-full">
                      <span>Today</span>
                      {orderCounts.dueToday > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {orderCounts.dueToday}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="tomorrow">Tomorrow</SelectItem>
                  <SelectItem value="this_week">Next 7 Days</SelectItem>
                  <SelectItem value="past_week">Past 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time Slot Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium">Time Slot</label>
              </div>
              <Select value={filters.timeSlot} onValueChange={(value) => updateFilter('timeSlot', value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Times</SelectItem>
                  <SelectItem value="morning">Morning (6AM-12PM)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12PM-6PM)</SelectItem>
                  <SelectItem value="evening">Evening (6PM-10PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Urgency Filter */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium">Urgency</label>
              </div>
              <Select value={filters.urgency} onValueChange={(value) => updateFilter('urgency', value)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-red-600 font-medium">Urgent (Next 2 Hours)</span>
                      {orderCounts.urgent > 0 && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          {orderCounts.urgent}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                  <SelectItem value="due_today">Due Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Stats */}
          {hasActiveFilters && (
            <div className="flex items-center gap-4 pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                Showing filtered results
              </div>
              <div className="flex items-center gap-3">
                {orderCounts.urgent > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-xs text-red-600 font-medium">
                      {orderCounts.urgent} urgent
                    </span>
                  </div>
                )}
                {orderCounts.dueToday > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-xs text-orange-600 font-medium">
                      {orderCounts.dueToday} due today
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
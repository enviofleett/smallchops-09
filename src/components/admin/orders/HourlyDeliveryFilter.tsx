import React, { useMemo, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, AlertTriangle } from 'lucide-react';
import { format, addDays, startOfHour, addHours, isSameDay } from 'date-fns';
import { toast } from 'sonner';

interface OrderCounts {
  today: Record<string, number>;
  tomorrow: Record<string, number>;
}

interface HourlyDeliveryFilterProps {
  selectedDay: 'today' | 'tomorrow' | null;
  selectedHour: string | null;
  onDayChange: (day: 'today' | 'tomorrow' | null) => void;
  onHourChange: (hour: string | null) => void;
  orderCounts?: OrderCounts | null;
  isLoading?: boolean;
  error?: Error | null;
}

interface TimeSlot {
  value: string;
  label: string;
  hour: number;
}

export const HourlyDeliveryFilter: React.FC<HourlyDeliveryFilterProps> = ({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  orderCounts,
  isLoading = false,
  error = null
}) => {
  // Memoized hourly slots generation - only recalculate if needed
  const hourlySlots = useMemo<TimeSlot[]>(() => {
    const slots: TimeSlot[] = [];
    try {
      for (let hour = 8; hour <= 22; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const testDate = new Date();
        testDate.setHours(hour, 0, 0, 0);
        
        // Validate date creation
        if (isNaN(testDate.getTime())) {
          console.warn(`Invalid date created for hour: ${hour}`);
          continue;
        }
        
        const displayTime = format(testDate, 'h:mm a');
        slots.push({ value: timeSlot, label: displayTime, hour });
      }
    } catch (error) {
      console.error('Critical error generating hourly slots:', error);
      toast.error('Failed to generate time slots. Please refresh the page.');
    }
    return slots;
  }, []); // Empty dependency array - slots never change

  // Memoized date calculations with error boundaries
  const { today, tomorrow } = useMemo(() => {
    try {
      const todayDate = new Date();
      const tomorrowDate = addDays(todayDate, 1);
      
      // Validate dates
      if (isNaN(todayDate.getTime()) || isNaN(tomorrowDate.getTime())) {
        throw new Error('Invalid date calculation');
      }
      
      return { today: todayDate, tomorrow: tomorrowDate };
    } catch (error) {
      console.error('Date calculation error:', error);
      toast.error('Date calculation failed. Using current time.');
      const fallback = new Date();
      return { today: fallback, tomorrow: fallback };
    }
  }, []); // Recalculate daily at component mount

  // Optimized filter clearing with useCallback
  const clearFilters = useCallback(() => {
    try {
      onDayChange(null);
      onHourChange(null);
    } catch (error) {
      console.error('Error clearing filters:', error);
      toast.error('Failed to clear filters');
    }
  }, [onDayChange, onHourChange]);

  // Safe count calculation with proper validation
  const getTotalCountForDay = useCallback((day: 'today' | 'tomorrow'): number => {
    if (!orderCounts?.hasOwnProperty(day)) return 0;
    
    try {
      const counts = orderCounts[day];
      if (!counts || typeof counts !== 'object') return 0;
      
      return Object.values(counts).reduce((sum, count) => {
        const numCount = Number(count);
        return sum + (isNaN(numCount) ? 0 : Math.max(0, numCount));
      }, 0);
    } catch (error) {
      console.warn(`Error calculating count for ${day}:`, error);
      return 0;
    }
  }, [orderCounts]);

  // Safe order count getter with validation
  const getOrderCountForSlot = useCallback((day: 'today' | 'tomorrow', slot: string): number => {
    try {
      const count = orderCounts?.[day]?.[slot];
      const numCount = Number(count);
      return isNaN(numCount) ? 0 : Math.max(0, numCount);
    } catch (error) {
      console.warn(`Error getting count for ${day} ${slot}:`, error);
      return 0;
    }
  }, [orderCounts]);

  // Error state display
  if (error) {
    return (
      <div className="space-y-4 p-4 border border-destructive/50 rounded-lg bg-destructive/5">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-medium">Filter Error</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Unable to load delivery filters. {error.message}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()}
        >
          Refresh Page
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Delivery time filters">
      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm rounded-lg z-10 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Loading filters...
          </div>
        </div>
      )}

      {/* Day Selection - Mobile Responsive with proper ARIA */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1" role="group" aria-label="Day selection">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => {
              const newDay = selectedDay === 'today' ? null : 'today';
              onDayChange(newDay);
              if (selectedDay === 'today') onHourChange(null);
            }}
            className="flex-1 sm:flex-none"
            disabled={isLoading}
            aria-pressed={selectedDay === 'today'}
            aria-label={`Filter by today ${format(today, 'MMM d')}`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Today
            <Badge variant="secondary" className="ml-2">
              {getTotalCountForDay('today')}
            </Badge>
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => {
              const newDay = selectedDay === 'tomorrow' ? null : 'tomorrow';
              onDayChange(newDay);
              if (selectedDay === 'tomorrow') onHourChange(null);
            }}
            className="flex-1 sm:flex-none"
            disabled={isLoading}
            aria-pressed={selectedDay === 'tomorrow'}
            aria-label={`Filter by tomorrow ${format(tomorrow, 'MMM d')}`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Tomorrow
            <Badge variant="secondary" className="ml-2">
              {getTotalCountForDay('tomorrow')}
            </Badge>
          </Button>
        </div>

        {(selectedDay || selectedHour) && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="w-full sm:w-auto"
            disabled={isLoading}
            aria-label="Clear all filters"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hour Selection - Production optimized */}
      {selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Delivery windows for {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
            </span>
          </div>
          
          {/* Desktop/Tablet: Select dropdown with proper accessibility */}
          <div className="hidden sm:block">
            <Select
              value={selectedHour || 'all'}
              onValueChange={(value) => onHourChange(value === 'all' ? null : value)}
              disabled={isLoading}
            >
              <SelectTrigger className="w-full sm:w-[200px]" aria-label="Select delivery time slot">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time slots</SelectItem>
                {hourlySlots.map((slot) => {
                  const count = getOrderCountForSlot(selectedDay, slot.value);
                  return (
                    <SelectItem key={slot.value} value={slot.value}>
                      <div className="flex items-center justify-between w-full">
                        <span>{slot.label}</span>
                        {count > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {count}
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile: Scrollable buttons with keyboard support */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Time slot selection">
              <Button
                variant={!selectedHour ? 'default' : 'outline'}
                onClick={() => onHourChange(null)}
                className="flex-shrink-0"
                size="sm"
                disabled={isLoading}
                aria-pressed={!selectedHour}
              >
                All times
              </Button>
              {hourlySlots.map((slot) => {
                const count = getOrderCountForSlot(selectedDay, slot.value);
                return (
                  <Button
                    key={slot.value}
                    variant={selectedHour === slot.value ? 'default' : 'outline'}
                    onClick={() => onHourChange(selectedHour === slot.value ? null : slot.value)}
                    className="flex-shrink-0"
                    size="sm"
                    disabled={isLoading}
                    aria-pressed={selectedHour === slot.value}
                    aria-label={`${slot.label} - ${count} orders`}
                  >
                    {slot.label}
                    {count > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active filters display with better semantics */}
      {(selectedDay || selectedHour) && (
        <div className="flex flex-wrap gap-2" role="status" aria-label="Active filters">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {selectedDay && (
            <Badge variant="outline">
              {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
            </Badge>
          )}
          {selectedHour && (
            <Badge variant="outline">
              {hourlySlots.find(slot => slot.value === selectedHour)?.label || selectedHour}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};
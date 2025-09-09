import React, { useMemo, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, X } from 'lucide-react';
import { format, addDays, startOfDay, isValid, parseISO } from 'date-fns';

// Production-ready delivery time slot configuration
const DELIVERY_CONFIG = {
  HOURS: {
    START: 8,
    END: 22,
  },
  TIME_FORMAT: 'h:mm a',
  DATE_FORMAT: 'MMM d',
} as const;

// Type definitions for better type safety
interface TimeSlot {
  readonly value: string;
  readonly label: string;
  readonly hour: number;
}

interface OrderCounts {
  readonly today: Record<string, number>;
  readonly tomorrow: Record<string, number>;
}

interface HourlyDeliveryFilterProps {
  selectedDay: 'today' | 'tomorrow' | null;
  selectedHour: string | null;
  onDayChange: (day: 'today' | 'tomorrow' | null) => void;
  onHourChange: (hour: string | null) => void;
  orderCounts?: OrderCounts | null;
  isLoading?: boolean;
}

export const HourlyDeliveryFilter: React.FC<HourlyDeliveryFilterProps> = ({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  orderCounts,
  isLoading = false
}) => {
  // Memoized time slots generation for performance
  const hourlySlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    
    try {
      for (let hour = DELIVERY_CONFIG.HOURS.START; hour <= DELIVERY_CONFIG.HOURS.END; hour++) {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const baseDate = new Date();
        baseDate.setHours(hour, 0, 0, 0);
        
        if (!isValid(baseDate)) {
          console.warn(`Invalid date created for hour ${hour}`);
          continue;
        }
        
        const displayTime = format(baseDate, DELIVERY_CONFIG.TIME_FORMAT);
        slots.push({ 
          value: timeSlot, 
          label: displayTime, 
          hour 
        });
      }
    } catch (error) {
      console.error('Error generating hourly slots:', error);
    }
    
    return slots;
  }, []);

  // Memoized date calculations
  const dates = useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);
    
    return {
      today,
      tomorrow,
      todayFormatted: format(today, DELIVERY_CONFIG.DATE_FORMAT),
      tomorrowFormatted: format(tomorrow, DELIVERY_CONFIG.DATE_FORMAT)
    };
  }, []);

  // Memoized handlers to prevent unnecessary re-renders
  const handleDayChange = useCallback((day: 'today' | 'tomorrow') => {
    try {
      if (selectedDay === day) {
        // Deselect if already selected
        onDayChange(null);
        onHourChange(null);
      } else {
        onDayChange(day);
        // Keep hour selection when switching days
      }
    } catch (error) {
      console.error('Error handling day change:', error);
    }
  }, [selectedDay, onDayChange, onHourChange]);

  const handleHourChange = useCallback((hour: string | null) => {
    try {
      // Validate hour format if provided
      if (hour && !/^\d{2}:\d{2}$/.test(hour)) {
        console.warn('Invalid hour format provided:', hour);
        return;
      }
      
      onHourChange(hour);
    } catch (error) {
      console.error('Error handling hour change:', error);
    }
  }, [onHourChange]);

  const clearAllFilters = useCallback(() => {
    try {
      onDayChange(null);
      onHourChange(null);
    } catch (error) {
      console.error('Error clearing filters:', error);
    }
  }, [onDayChange, onHourChange]);

  // Safe count calculation with error handling
  const getCountForTimeSlot = useCallback((day: 'today' | 'tomorrow', timeSlot: string): number => {
    try {
      if (!orderCounts || !orderCounts[day]) return 0;
      return orderCounts[day][timeSlot] || 0;
    } catch (error) {
      console.warn('Error getting count for time slot:', error);
      return 0;
    }
  }, [orderCounts]);

  const getTotalCountForDay = useCallback((day: 'today' | 'tomorrow'): number => {
    try {
      if (!orderCounts || !orderCounts[day]) return 0;
      
      return Object.values(orderCounts[day]).reduce((sum, count) => {
        const validCount = typeof count === 'number' && !isNaN(count) ? count : 0;
        return sum + validCount;
      }, 0);
    } catch (error) {
      console.warn('Error calculating total count for day:', error);
      return 0;
    }
  }, [orderCounts]);

  // Check if filters are active
  const hasActiveFilters = Boolean(selectedDay || selectedHour);

  return (
    <div className="space-y-4" role="region" aria-label="Delivery time filters">
      {/* Day Selection */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1" role="group" aria-label="Day selection">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => handleDayChange('today')}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
            aria-pressed={selectedDay === 'today'}
            aria-label={`Filter by today's deliveries (${dates.todayFormatted}). ${getTotalCountForDay('today')} orders.`}
          >
            <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
            Today
            <Badge 
              variant="secondary" 
              className="ml-2"
              aria-label={`${getTotalCountForDay('today')} orders`}
            >
              {isLoading ? '...' : getTotalCountForDay('today')}
            </Badge>
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => handleDayChange('tomorrow')}
            disabled={isLoading}
            className="flex-1 sm:flex-none"
            aria-pressed={selectedDay === 'tomorrow'}
            aria-label={`Filter by tomorrow's deliveries (${dates.tomorrowFormatted}). ${getTotalCountForDay('tomorrow')} orders.`}
          >
            <Calendar className="w-4 h-4 mr-2" aria-hidden="true" />
            Tomorrow
            <Badge 
              variant="secondary" 
              className="ml-2"
              aria-label={`${getTotalCountForDay('tomorrow')} orders`}
            >
              {isLoading ? '...' : getTotalCountForDay('tomorrow')}
            </Badge>
          </Button>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={clearAllFilters}
            disabled={isLoading}
            className="w-full sm:w-auto"
            aria-label="Clear all delivery time filters"
          >
            <X className="w-4 h-4 mr-2" aria-hidden="true" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hour Selection - Only show when day is selected */}
      {selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" aria-hidden="true" />
            <span>
              Delivery windows for {selectedDay === 'today' ? dates.todayFormatted : dates.tomorrowFormatted}
            </span>
          </div>
          
          {/* Desktop/Tablet: Select dropdown */}
          <div className="hidden sm:block">
            <Select
              value={selectedHour || 'all'}
              onValueChange={(value) => handleHourChange(value === 'all' ? null : value)}
              disabled={isLoading}
            >
              <SelectTrigger 
                className="w-full sm:w-[200px]"
                aria-label="Select delivery time slot"
              >
                <SelectValue placeholder={isLoading ? "Loading..." : "Select time slot"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center justify-between w-full">
                    <span>All time slots</span>
                    <Badge variant="secondary" className="ml-2">
                      {getTotalCountForDay(selectedDay)}
                    </Badge>
                  </div>
                </SelectItem>
                {hourlySlots.map((slot) => {
                  const count = getCountForTimeSlot(selectedDay, slot.value);
                  return (
                    <SelectItem 
                      key={slot.value} 
                      value={slot.value}
                      aria-label={`${slot.label} - ${count} orders`}
                    >
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

          {/* Mobile: Scrollable buttons */}
          <div className="sm:hidden">
            <div 
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300"
              role="group"
              aria-label="Time slot selection"
            >
              <Button
                variant={!selectedHour ? 'default' : 'outline'}
                onClick={() => handleHourChange(null)}
                disabled={isLoading}
                className="flex-shrink-0"
                size="sm"
                aria-pressed={!selectedHour}
                aria-label={`All time slots - ${getTotalCountForDay(selectedDay)} orders`}
              >
                All times
                <Badge variant="secondary" className="ml-1 text-xs">
                  {getTotalCountForDay(selectedDay)}
                </Badge>
              </Button>
              
              {hourlySlots.map((slot) => {
                const count = getCountForTimeSlot(selectedDay, slot.value);
                const isSelected = selectedHour === slot.value;
                
                return (
                  <Button
                    key={slot.value}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handleHourChange(isSelected ? null : slot.value)}
                    disabled={isLoading}
                    className="flex-shrink-0"
                    size="sm"
                    aria-pressed={isSelected}
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

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2" role="region" aria-label="Active filters">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {selectedDay && (
            <Badge variant="outline" className="flex items-center gap-1">
              {selectedDay === 'today' ? dates.todayFormatted : dates.tomorrowFormatted}
              <button
                onClick={() => onDayChange(null)}
                className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5"
                aria-label="Remove day filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {selectedHour && (
            <Badge variant="outline" className="flex items-center gap-1">
              {hourlySlots.find(slot => slot.value === selectedHour)?.label || selectedHour}
              <button
                onClick={() => onHourChange(null)}
                className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5"
                aria-label="Remove time filter"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading delivery schedules...
        </div>
      )}
    </div>
  );
};
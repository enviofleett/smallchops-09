import React, { useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, AlertCircle, RefreshCw, Activity } from 'lucide-react';
import { format, addDays } from 'date-fns';

interface HourlyDeliveryFilterProps {
  selectedDay: 'today' | 'tomorrow' | null;
  selectedHour: string | null;
  onDayChange: (day: 'today' | 'tomorrow' | null) => void;
  onHourChange: (hour: string | null) => void;
  orderCounts?: {
    today: Record<string, number>;
    tomorrow: Record<string, number>;
  };
  loading?: boolean;
  error?: Error | null;
}

export const HourlyDeliveryFilter: React.FC<HourlyDeliveryFilterProps> = ({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  orderCounts,
  loading = false,
  error = null
}) => {
  // Generate hourly slots from 8 AM to 10 PM with validation and memoization
  const generateHourlySlots = useCallback(() => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      try {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const testDate = new Date();
        testDate.setHours(hour, 0, 0, 0);
        const displayTime = format(testDate, 'h:mm a');
        slots.push({ value: timeSlot, label: displayTime, hour });
      } catch (error) {
        console.error('Error generating time slot for hour:', hour, error);
      }
    }
    return slots;
  }, []);

  const hourlySlots = useMemo(() => generateHourlySlots(), [generateHourlySlots]);
  
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  const clearFilters = useCallback(() => {
    onDayChange(null);
    onHourChange(null);
    
    // Track filter clear analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'filter_cleared', {
        event_category: 'order_management',
        event_label: 'hourly_delivery_filter'
      });
    }
  }, [onDayChange, onHourChange]);

  const getTotalCountForDay = useCallback((day: 'today' | 'tomorrow') => {
    if (!orderCounts || !orderCounts[day]) return 0;
    
    try {
      const counts = orderCounts[day];
      return Object.values(counts).reduce((sum, count) => {
        const numCount = typeof count === 'number' && !isNaN(count) ? count : 0;
        return sum + numCount;
      }, 0);
    } catch (error) {
      console.error('Error calculating total count for day:', day, error);
      return 0;
    }
  }, [orderCounts]);

  const handleDayChange = useCallback((day: 'today' | 'tomorrow') => {
    const newDay = selectedDay === day ? null : day;
    onDayChange(newDay);
    
    // Clear hour selection when changing day
    if (selectedDay === day) {
      onHourChange(null);
    }
    
    // Track day selection analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'day_filter_changed', {
        event_category: 'order_management',
        event_label: `hourly_delivery_filter_${newDay || 'cleared'}`,
        value: getTotalCountForDay(day)
      });
    }
  }, [selectedDay, onDayChange, onHourChange, getTotalCountForDay]);

  const handleHourChange = useCallback((hour: string | null) => {
    const newHour = selectedHour === hour ? null : hour;
    onHourChange(newHour);
    
    // Track hour selection analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'hour_filter_changed', {
        event_category: 'order_management',
        event_label: `hourly_delivery_filter_${newHour || 'all_hours'}`,
        value: selectedDay && orderCounts?.[selectedDay]?.[hour || ''] || 0
      });
    }
  }, [selectedHour, onHourChange, selectedDay, orderCounts]);

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Failed to load delivery schedule data</p>
            <p className="text-sm opacity-75">Please refresh to try again</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="ml-auto border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day Selection - Mobile Responsive with Production Features */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => handleDayChange('today')}
            className="flex-1 sm:flex-none relative transition-all duration-200 hover:scale-[1.02]"
            disabled={loading || (!orderCounts && !loading) || getTotalCountForDay('today') === 0}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Today</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(today, 'MMM d')})
            </span>
            {orderCounts && getTotalCountForDay('today') > 0 && (
              <Badge 
                variant={selectedDay === 'today' ? 'secondary' : 'outline'} 
                className="ml-2 text-xs animate-in fade-in-50"
              >
                {getTotalCountForDay('today')}
              </Badge>
            )}
            {loading && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && !orderCounts && (
              <div className="ml-2 w-4 h-4 text-muted-foreground">
                <Activity className="w-4 h-4" />
              </div>
            )}
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => handleDayChange('tomorrow')}
            className="flex-1 sm:flex-none relative transition-all duration-200 hover:scale-[1.02]"
            disabled={loading || (!orderCounts && !loading) || getTotalCountForDay('tomorrow') === 0}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Tomorrow</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(tomorrow, 'MMM d')})
            </span>
            {orderCounts && getTotalCountForDay('tomorrow') > 0 && (
              <Badge 
                variant={selectedDay === 'tomorrow' ? 'secondary' : 'outline'} 
                className="ml-2 text-xs animate-in fade-in-50"
              >
                {getTotalCountForDay('tomorrow')}
              </Badge>
            )}
            {loading && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && !orderCounts && (
              <div className="ml-2 w-4 h-4 text-muted-foreground">
                <Activity className="w-4 h-4" />
              </div>
            )}
          </Button>
        </div>

        {(selectedDay || selectedHour) && !loading && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="w-full sm:w-auto transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hour Selection - Only show when day is selected and has orders */}
      {selectedDay && orderCounts && getTotalCountForDay(selectedDay) > 0 && !loading && (
        <div className="space-y-2 animate-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Delivery slots for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')} 
              ({getTotalCountForDay(selectedDay)} orders)
            </span>
          </div>
          
          {/* Desktop/Tablet: Select dropdown */}
          <div className="hidden sm:block">
            <Select
              value={selectedHour || 'all'}
              onValueChange={(value) => handleHourChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[280px] transition-all duration-200 hover:border-primary">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all" className="font-medium">
                  <div className="flex items-center justify-between w-full">
                    <span>All delivery slots</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {getTotalCountForDay(selectedDay)} orders
                    </Badge>
                  </div>
                </SelectItem>
                {hourlySlots.map((slot) => {
                  const slotCount = orderCounts[selectedDay]?.[slot.value] || 0;
                  if (slotCount === 0) return null; // Only show slots with orders
                  
                  return (
                    <SelectItem key={slot.value} value={slot.value}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{slot.label}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {slotCount} {slotCount === 1 ? 'order' : 'orders'}
                        </Badge>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile: Scrollable buttons with improved UX */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
              <Button
                variant={!selectedHour ? 'default' : 'outline'}
                onClick={() => handleHourChange(null)}
                className="flex-shrink-0 transition-all duration-200"
                size="sm"
              >
                All slots
                <Badge variant="outline" className="ml-1 text-xs">
                  {getTotalCountForDay(selectedDay)}
                </Badge>
              </Button>
              {hourlySlots.map((slot) => {
                const slotCount = orderCounts[selectedDay]?.[slot.value] || 0;
                if (slotCount === 0) return null; // Only show slots with orders
                
                return (
                  <Button
                    key={slot.value}
                    variant={selectedHour === slot.value ? 'default' : 'outline'}
                    onClick={() => handleHourChange(slot.value)}
                    className="flex-shrink-0 transition-all duration-200"
                    size="sm"
                  >
                    <span className="font-medium">{slot.label}</span>
                    <Badge 
                      variant={selectedHour === slot.value ? 'secondary' : 'outline'} 
                      className="ml-1 text-xs"
                    >
                      {slotCount}
                    </Badge>
                  </Button>
                );
              })}
            </div>
           </div>
          </div>
        )}
        
        {/* Loading state for hour selection */}
        {loading && selectedDay && (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-10 bg-muted rounded"></div>
          </div>
        )}

        {/* No orders message with improved UX */}
        {selectedDay && orderCounts && getTotalCountForDay(selectedDay) === 0 && !loading && (
          <div className="text-center py-8 text-muted-foreground animate-in fade-in-50">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <div className="space-y-2">
              <p className="font-medium text-lg">No delivery orders scheduled</p>
              <p className="text-sm">
                for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearFilters}
                className="mt-4 transition-all duration-200"
              >
                View All Orders
              </Button>
            </div>
          </div>
        )}

        {/* Active filters display with enhanced styling */}
        {(selectedDay || selectedHour) && !loading && (
          <div className="flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
            <span className="text-sm text-muted-foreground font-medium">Active filters:</span>
            {selectedDay && (
              <Badge variant="outline" className="transition-all duration-200 hover:bg-primary/10">
                📅 {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
              </Badge>
            )}
            {selectedHour && (
              <Badge variant="outline" className="transition-all duration-200 hover:bg-primary/10">
                🕒 {hourlySlots.find(slot => slot.value === selectedHour)?.label}
              </Badge>
            )}
          </div>
        )}
        
        {/* Data freshness indicator (production feature) */}
        {orderCounts && !loading && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Data updated {format(new Date(), 'h:mm a')}</span>
            </div>
          </div>
        )}
     </div>
   );
};
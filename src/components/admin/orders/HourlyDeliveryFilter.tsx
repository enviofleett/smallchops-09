import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar } from 'lucide-react';
import { format, addDays, startOfHour, addHours, isSameDay } from 'date-fns';

interface HourlyDeliveryFilterProps {
  selectedDay: 'today' | 'tomorrow' | null;
  selectedHour: string | null;
  onDayChange: (day: 'today' | 'tomorrow' | null) => void;
  onHourChange: (hour: string | null) => void;
  orderCounts?: {
    today: Record<string, number>;
    tomorrow: Record<string, number>;
  };
}

export const HourlyDeliveryFilter: React.FC<HourlyDeliveryFilterProps> = ({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  orderCounts
}) => {
  // Generate hourly slots from 8 AM to 10 PM with validation
  const generateHourlySlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      try {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const testDate = new Date();
        testDate.setHours(hour, 0, 0, 0);
        const displayTime = format(testDate, 'h:mm a');
        slots.push({ value: timeSlot, label: displayTime, hour });
      } catch (error) {
        console.warn('Error generating time slot for hour:', hour, error);
      }
    }
    return slots;
  };

  const hourlySlots = generateHourlySlots();
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const clearFilters = () => {
    onDayChange(null);
    onHourChange(null);
  };

  const getTotalCountForDay = (day: 'today' | 'tomorrow') => {
    if (!orderCounts || !orderCounts[day]) return 0;
    
    try {
      const counts = orderCounts[day];
      return Object.values(counts).reduce((sum, count) => {
        const numCount = typeof count === 'number' ? count : 0;
        return sum + numCount;
      }, 0);
    } catch (error) {
      console.warn('Error calculating total count for day:', day, error);
      return 0;
    }
  };

  return (
    <div className="space-y-4">
      {/* Day Selection - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => {
              const newDay = selectedDay === 'today' ? null : 'today';
              onDayChange(newDay);
              if (selectedDay === 'today') onHourChange(null);
            }}
            className="flex-1 sm:flex-none relative"
            disabled={!orderCounts || getTotalCountForDay('today') === 0}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Today</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(today, 'MMM d')})
            </span>
            {orderCounts && getTotalCountForDay('today') > 0 && (
              <Badge 
                variant={selectedDay === 'today' ? 'secondary' : 'outline'} 
                className="ml-2 text-xs"
              >
                {getTotalCountForDay('today')}
              </Badge>
            )}
            {!orderCounts && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => {
              const newDay = selectedDay === 'tomorrow' ? null : 'tomorrow';
              onDayChange(newDay);
              if (selectedDay === 'tomorrow') onHourChange(null);
            }}
            className="flex-1 sm:flex-none relative"
            disabled={!orderCounts || getTotalCountForDay('tomorrow') === 0}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Tomorrow</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(tomorrow, 'MMM d')})
            </span>
            {orderCounts && getTotalCountForDay('tomorrow') > 0 && (
              <Badge 
                variant={selectedDay === 'tomorrow' ? 'secondary' : 'outline'} 
                className="ml-2 text-xs"
              >
                {getTotalCountForDay('tomorrow')}
              </Badge>
            )}
            {!orderCounts && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
          </Button>
        </div>

        {(selectedDay || selectedHour) && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="w-full sm:w-auto"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hour Selection - Only show when day is selected and has orders */}
      {selectedDay && orderCounts && getTotalCountForDay(selectedDay) > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Delivery slots for {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')} 
              ({getTotalCountForDay(selectedDay)} orders)
            </span>
          </div>
          
          {/* Desktop/Tablet: Select dropdown */}
          <div className="hidden sm:block">
            <Select
              value={selectedHour || 'all'}
              onValueChange={(value) => onHourChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All delivery slots ({getTotalCountForDay(selectedDay)} orders)
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

          {/* Mobile: Scrollable buttons */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={!selectedHour ? 'default' : 'outline'}
                onClick={() => onHourChange(null)}
                className="flex-shrink-0"
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
                    onClick={() => onHourChange(selectedHour === slot.value ? null : slot.value)}
                    className="flex-shrink-0"
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
       

       {/* No orders message */}
       {selectedDay && orderCounts && getTotalCountForDay(selectedDay) === 0 && (
         <div className="text-center py-6 text-muted-foreground">
           <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
           <p className="font-medium">No delivery orders scheduled</p>
           <p className="text-sm">
             for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')}
           </p>
         </div>
       )}

       {/* Active filters display */}
       {(selectedDay || selectedHour) && (
         <div className="flex flex-wrap gap-2">
           <span className="text-sm text-muted-foreground">Active filters:</span>
           {selectedDay && (
             <Badge variant="outline">
               {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
             </Badge>
           )}
           {selectedHour && (
             <Badge variant="outline">
               {hourlySlots.find(slot => slot.value === selectedHour)?.label}
             </Badge>
           )}
         </div>
       )}
    </div>
  );
};
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
  // Generate hourly slots from 8 AM to 10 PM
  const generateHourlySlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
      const displayTime = format(new Date().setHours(hour, 0, 0, 0), 'h:mm a');
      slots.push({ value: timeSlot, label: displayTime, hour });
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
    if (!orderCounts) return 0;
    const counts = orderCounts[day];
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  };

  return (
    <div className="space-y-4">
      {/* Day Selection - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => {
              onDayChange(selectedDay === 'today' ? null : 'today');
              if (selectedDay === 'today') onHourChange(null);
            }}
            className="flex-1 sm:flex-none"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Today
            {orderCounts && (
              <Badge variant="secondary" className="ml-2">
                {getTotalCountForDay('today')}
              </Badge>
            )}
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => {
              onDayChange(selectedDay === 'tomorrow' ? null : 'tomorrow');
              if (selectedDay === 'tomorrow') onHourChange(null);
            }}
            className="flex-1 sm:flex-none"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Tomorrow
            {orderCounts && (
              <Badge variant="secondary" className="ml-2">
                {getTotalCountForDay('tomorrow')}
              </Badge>
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

      {/* Hour Selection - Only show when day is selected */}
      {selectedDay && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Delivery windows for {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
            </span>
          </div>
          
          {/* Desktop/Tablet: Select dropdown */}
          <div className="hidden sm:block">
            <Select
              value={selectedHour || ''}
              onValueChange={(value) => onHourChange(value === '' ? null : value)}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select time slot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All time slots</SelectItem>
                {hourlySlots.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    <div className="flex items-center justify-between w-full">
                      <span>{slot.label}</span>
                      {orderCounts && orderCounts[selectedDay][slot.value] > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {orderCounts[selectedDay][slot.value]}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
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
                All times
              </Button>
              {hourlySlots.map((slot) => (
                <Button
                  key={slot.value}
                  variant={selectedHour === slot.value ? 'default' : 'outline'}
                  onClick={() => onHourChange(selectedHour === slot.value ? null : slot.value)}
                  className="flex-shrink-0"
                  size="sm"
                >
                  {slot.label}
                  {orderCounts && orderCounts[selectedDay][slot.value] > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {orderCounts[selectedDay][slot.value]}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
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
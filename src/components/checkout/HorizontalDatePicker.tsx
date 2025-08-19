import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySlot } from '@/utils/deliveryScheduling';

interface HorizontalDatePickerProps {
  selectedDate?: string;
  availableSlots: DeliverySlot[];
  onDateSelect: (date: string) => void;
  className?: string;
}

export const HorizontalDatePicker: React.FC<HorizontalDatePickerProps> = ({
  selectedDate,
  availableSlots,
  onDateSelect,
  className
}) => {
  const [startIndex, setStartIndex] = React.useState(0);
  const visibleDates = 7; // Show 7 dates at a time

  // Filter only available dates
  const availableDates = availableSlots.filter(slot => 
    slot.is_business_day && !slot.is_holiday && slot.time_slots.some(ts => ts.available)
  );

  const canGoNext = startIndex + visibleDates < availableDates.length;
  const canGoPrev = startIndex > 0;

  const handleNext = () => {
    if (canGoNext) {
      setStartIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (canGoPrev) {
      setStartIndex(prev => prev - 1);
    }
  };

  const visibleSlots = availableDates.slice(startIndex, startIndex + visibleDates);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Select delivery date</h3>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canGoPrev}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-hidden">
        {visibleSlots.map((slot) => {
          const date = parseISO(slot.date);
          const isSelected = selectedDate && isSameDay(date, parseISO(selectedDate));
          const isToday = isSameDay(date, new Date());

          return (
            <Button
              key={slot.date}
              variant={isSelected ? "default" : "outline"}
              onClick={() => onDateSelect(slot.date)}
              className={cn(
                "flex-1 min-w-0 h-16 flex flex-col items-center justify-center gap-1 px-2",
                "border-2 transition-all duration-200 hover:scale-105",
                isSelected && "bg-primary text-primary-foreground border-primary",
                !isSelected && "hover:bg-muted/50"
              )}
            >
              <span className="text-xs font-medium">
                {format(date, 'EEE')}
              </span>
              <span className={cn(
                "text-sm font-bold",
                isToday && !isSelected && "text-primary"
              )}>
                {format(date, 'd')}
              </span>
              {isToday && (
                <span className="text-xs text-primary">Today</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
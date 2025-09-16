import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
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
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <CalendarIcon className="w-4 h-4" />
          Select delivery date
        </h3>
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

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
                "flex-shrink-0 min-w-[80px] h-16 sm:h-18 flex flex-col items-center justify-center gap-1 px-3",
                "border-2 transition-all duration-200 hover:scale-105 active:scale-95",
                "text-center touch-manipulation",
                isSelected && "bg-primary text-primary-foreground border-primary shadow-md",
                !isSelected && "hover:bg-muted/50 hover:border-primary/20"
              )}
            >
              <span className="text-xs font-medium opacity-80">
                {format(date, 'EEE')}
              </span>
              <span className={cn(
                "text-lg font-bold",
                isToday && !isSelected && "text-primary"
              )}>
                {format(date, 'd')}
              </span>
              {isToday && (
                <span className="text-xs opacity-80">Today</span>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
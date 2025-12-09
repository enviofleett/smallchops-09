import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon, AlertCircle } from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySlot, isDateClosed, isOrderingCutoffPassed } from '@/utils/deliveryScheduling';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

  // Filter only available dates (business days, not holidays, with available slots)
  const availableDates = availableSlots.filter(slot => 
    slot.is_business_day && !slot.is_holiday && slot.time_slots.some(ts => ts.available)
  );

  // Also get closed dates for visual feedback (show first few with warnings)
  const closedDates = availableSlots.filter(slot => {
    const date = parseISO(slot.date);
    const closedCheck = isDateClosed(date);
    return closedCheck.closed || slot.is_holiday;
  });

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

  // Show warning if there are upcoming closures
  const upcomingClosures = closedDates.slice(0, 3);

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
            className="h-8 w-8 p-0 touch-manipulation active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext}
            className="h-8 w-8 p-0 touch-manipulation active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Show closure notice if any upcoming closures */}
      {upcomingClosures.length > 0 && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Note: Store closed {upcomingClosures.map(c => format(parseISO(c.date), 'MMM d')).join(', ')}
            {upcomingClosures[0]?.closure_reason && ` - ${upcomingClosures[0].closure_reason}`}
          </span>
        </div>
      )}

      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-0.5 xs:gap-1 sm:gap-2 min-w-max px-0.5 xs:px-1">
          <TooltipProvider>
            {visibleSlots.map((slot) => {
              const date = parseISO(slot.date);
              const isSelected = selectedDate && isSameDay(date, parseISO(selectedDate));
              const isToday = isSameDay(date, new Date());
              const availableSlotCount = slot.time_slots.filter(ts => ts.available).length;

              return (
                <Tooltip key={slot.date}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => onDateSelect(slot.date)}
                      className={cn(
                        "flex-shrink-0 w-[calc((100vw-2rem)/7)] min-w-[38px] max-w-[80px] h-12 xs:h-14 sm:h-16",
                        "flex flex-col items-center justify-center gap-0.5 xs:gap-1 px-0.5 xs:px-1 sm:px-2",
                        "border transition-all duration-200 hover:scale-105 active:scale-95",
                        "text-center touch-manipulation rounded-md xs:rounded-lg",
                        isSelected && "bg-primary text-primary-foreground border-primary shadow-md",
                        !isSelected && "hover:bg-muted/50 hover:border-primary/20"
                      )}
                    >
                      <span className="text-[8px] xs:text-[10px] sm:text-xs font-medium opacity-80 leading-tight">
                        {format(date, 'EEEEE')}
                      </span>
                      <span className={cn(
                        "text-xs xs:text-sm sm:text-base font-bold leading-none",
                        isToday && !isSelected && "text-primary"
                      )}>
                        {format(date, 'd')}
                      </span>
                      {isToday && (
                        <span className="text-[7px] xs:text-[8px] sm:text-xs opacity-80 leading-tight">Now</span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(date, 'EEEE, MMMM d')}</p>
                    <p className="text-xs text-muted-foreground">{availableSlotCount} slots available</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
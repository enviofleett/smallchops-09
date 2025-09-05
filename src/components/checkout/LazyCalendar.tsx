import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, isBefore, startOfDay, isWeekend, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useLazyDeliverySlots } from '@/hooks/useLazyDeliverySlots';

interface LazyCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date | undefined) => void;
  isDateAvailable: (date: Date) => boolean;
  className?: string;
}

export const LazyCalendar: React.FC<LazyCalendarProps> = ({
  selectedDate,
  onDateSelect,
  isDateAvailable,
  className
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || new Date());
  const { slots, loading, error, loadMonth, prefetchNextMonth } = useLazyDeliverySlots(currentMonth);

  // Load month data when month changes
  useEffect(() => {
    loadMonth(currentMonth);
  }, [currentMonth, loadMonth]);

  // Prefetch next month on hover/interaction
  const handleCalendarInteraction = useCallback(() => {
    prefetchNextMonth();
  }, [prefetchNextMonth]);

  // Production-ready date disabled function - only disable past dates to show all available dates
  const isDateDisabled = useCallback((date: Date) => {
    // Only disable past dates - show all future dates for better UX
    return isBefore(startOfDay(date), startOfDay(new Date()));
  }, []);

  // Get date modifiers based on loaded slots
  const getDateModifiers = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const slot = slots.find(s => s.date === dateStr);
    
    if (slot?.is_holiday) return 'holiday';
    if (!slot?.is_business_day) return 'closed';
    if (slot && slot.time_slots.some(ts => ts.available)) return 'available';
    if (slot && !slot.time_slots.some(ts => ts.available)) return 'unavailable';
    
    return undefined;
  }, [slots]);

  // Calendar event handlers
  const handleMonthChange = useCallback((date: Date) => {
    setCurrentMonth(date);
  }, []);

  const handleDateClick = useCallback((date: Date | undefined) => {
    onDateSelect(date);
  }, [onDateSelect]);

  if (loading && slots.length === 0) {
    return (
      <div className={cn("w-full overflow-hidden rounded-lg bg-background", className)}>
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-6 bg-muted rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-8 sm:h-10 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn("w-full overflow-visible rounded-lg bg-background", className)}
      onMouseEnter={handleCalendarInteraction}
      onFocus={handleCalendarInteraction}
    >
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded p-2 mb-2">
          ⚠️ {error}
        </div>
      )}
      
      <Calendar 
        mode="single" 
        selected={selectedDate} 
        onSelect={handleDateClick}
        month={currentMonth}
        onMonthChange={handleMonthChange}
        disabled={isDateDisabled}
        showOutsideDays={true}
        fixedWeeks={true}
        className="w-full mx-auto rounded-lg border border-border/50 pointer-events-auto shadow-sm hover:shadow-md transition-shadow duration-200" 
        classNames={{
          months: "flex flex-col space-y-1 sm:space-y-2",
          month: "space-y-1 sm:space-y-2 w-full",
          caption: "flex justify-center pt-1 sm:pt-2 pb-1 relative items-center",
          caption_label: "text-sm sm:text-base font-semibold text-foreground",
          nav: "space-x-1 flex items-center",
          nav_button: "h-7 w-7 sm:h-8 sm:w-8 bg-background hover:bg-accent hover:text-accent-foreground border border-border rounded-md sm:rounded-lg transition-colors duration-200 touch-manipulation",
          nav_button_previous: "absolute left-1 sm:left-2",
          nav_button_next: "absolute right-1 sm:right-2",
          table: "w-full border-collapse",
          head_row: "flex mb-1",
          head_cell: "text-muted-foreground rounded-md w-full font-medium text-xs uppercase tracking-wide py-1 text-center flex-1",
          row: "flex w-full mt-0.5",
          cell: "relative p-0 text-center focus-within:relative focus-within:z-20 flex-1 aspect-square min-w-0",
          day: cn(
            "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9 mx-auto font-normal transition-all duration-200",
            "hover:bg-accent hover:text-accent-foreground rounded-md sm:rounded-lg",
            "focus:bg-accent focus:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-primary",
            "aria-selected:opacity-100 touch-manipulation text-xs sm:text-sm",
            "active:scale-95 flex items-center justify-center"
          ),
          day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md ring-1 sm:ring-2 ring-primary ring-offset-1",
          day_today: "bg-accent text-accent-foreground font-semibold ring-1 ring-primary/30",
          day_outside: "text-muted-foreground/50 opacity-50 hover:opacity-80 transition-opacity",
          day_disabled: "text-muted-foreground/20 opacity-20 cursor-not-allowed line-through pointer-events-none",
          day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "opacity-0"
        }}
        modifiers={{
          holiday: date => getDateModifiers(date) === 'holiday',
          closed: date => getDateModifiers(date) === 'closed',
          weekend: date => isWeekend(date),
          unavailable: date => getDateModifiers(date) === 'unavailable',
          available: date => getDateModifiers(date) === 'available',
          loading: date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            return !slots.some(s => s.date === dateStr) && !isBefore(startOfDay(date), startOfDay(new Date()));
          }
        }} 
        modifiersStyles={{
          holiday: {
            backgroundColor: 'hsl(var(--destructive) / 0.1)',
            color: 'hsl(var(--destructive))',
            border: '1px solid hsl(var(--destructive) / 0.3)'
          },
          closed: {
            backgroundColor: 'hsl(var(--muted) / 0.5)',
            color: 'hsl(var(--muted-foreground))',
            textDecoration: 'line-through'
          },
          unavailable: {
            backgroundColor: 'hsl(var(--muted) / 0.2)',
            color: 'hsl(var(--muted-foreground))',
            opacity: '0.7'
          },
          available: {
            backgroundColor: 'hsl(var(--success) / 0.15)',
            color: 'hsl(var(--success))',
            border: '1px solid hsl(var(--success) / 0.3)',
            fontWeight: '500'
          },
          loading: {
            backgroundColor: 'hsl(var(--muted) / 0.1)',
            color: 'hsl(var(--muted-foreground))',
            opacity: '0.8',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          },
          weekend: {
            backgroundColor: 'transparent',
            color: 'hsl(var(--muted-foreground))'
          }
        }} 
      />
      
      {loading && slots.length > 0 && (
        <div className="text-xs text-muted-foreground text-center py-2 flex items-center justify-center gap-2">
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
          Loading month data...
        </div>
      )}
    </div>
  );
};
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon, ChevronDown, Search } from 'lucide-react';
import { format, parseISO, isSameDay, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { DeliverySlot } from '@/utils/deliveryScheduling';

interface DropdownDatePickerProps {
  selectedDate?: string;
  availableSlots: DeliverySlot[];
  onDateSelect: (date: string) => void;
  className?: string;
}

export const DropdownDatePicker: React.FC<DropdownDatePickerProps> = ({
  selectedDate,
  availableSlots,
  onDateSelect,
  className
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Filter only available dates
  const availableDates = availableSlots.filter(slot => 
    slot.is_business_day && !slot.is_holiday && slot.time_slots.some(ts => ts.available)
  );

  // Smart search filtering
  const filteredDates = React.useMemo(() => {
    if (!searchQuery.trim()) return availableDates;
    
    const query = searchQuery.toLowerCase().trim();
    
    return availableDates.filter(slot => {
      const date = parseISO(slot.date);
      const dayName = format(date, 'EEEE').toLowerCase();
      const monthName = format(date, 'MMMM').toLowerCase();
      const shortMonth = format(date, 'MMM').toLowerCase();
      const dateStr = format(date, 'MMM d').toLowerCase();
      const fullDate = format(date, 'EEEE, MMMM d').toLowerCase();
      
      // Smart keyword matching
      if (query === 'today' && isToday(date)) return true;
      if (query === 'tomorrow' && isTomorrow(date)) return true;
      
      // Match day names, months, or date strings
      return (
        dayName.includes(query) ||
        monthName.includes(query) ||
        shortMonth.includes(query) ||
        dateStr.includes(query) ||
        fullDate.includes(query) ||
        slot.date.includes(query)
      );
    });
  }, [availableDates, searchQuery]);

  const selectedSlot = selectedDate ? availableDates.find(slot => slot.date === selectedDate) : null;
  const selectedDateObj = selectedDate ? parseISO(selectedDate) : null;
  const isTodaySelected = selectedDateObj ? isSameDay(selectedDateObj, new Date()) : false;

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleDateSelect = (date: string) => {
    onDateSelect(date);
    setIsOpen(false);
    setSearchQuery('');
  };

  const getDisplayText = () => {
    if (!selectedDateObj) return "Select delivery date";
    
    const dayName = format(selectedDateObj, 'EEEE');
    const dateStr = format(selectedDateObj, 'MMM d');
    
    if (isTodaySelected) {
      return `Today, ${dateStr}`;
    }
    
    return `${dayName}, ${dateStr}`;
  };

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full justify-between h-12 px-4 text-left font-normal",
          "border-2 hover:border-primary/20 focus:border-primary focus:ring-2 focus:ring-primary/20",
          "transition-all duration-200 touch-manipulation",
          !selectedDate && "text-muted-foreground",
          isOpen && "border-primary shadow-md"
        )}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 opacity-70" />
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <ChevronDown 
          className={cn(
            "w-4 h-4 opacity-70 transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </Button>

      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 right-0 mt-1 z-50",
          "bg-background border border-border rounded-lg shadow-lg",
          "max-h-64 overflow-hidden",
          "animate-in slide-in-from-top-2 duration-200"
        )}>
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search dates (e.g., today, Friday, Dec 25)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-0 bg-muted/50 focus:bg-background transition-colors"
              />
            </div>
          </div>
          
          {/* Date List */}
          <div className="max-h-48 overflow-y-auto scrollbar-hide">
            <div className="p-2">
              {filteredDates.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {searchQuery ? 'No dates match your search' : 'No delivery dates available'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredDates.map((slot) => {
                    const date = parseISO(slot.date);
                    const isSelected = selectedDate && isSameDay(date, parseISO(selectedDate));
                    const isDateToday = isSameDay(date, new Date());
                    
                    return (
                      <Button
                        key={slot.date}
                        variant="ghost"
                        onClick={() => handleDateSelect(slot.date)}
                        className={cn(
                          "w-full justify-start h-12 px-3 text-left font-normal",
                          "hover:bg-accent transition-colors duration-200",
                          "touch-manipulation active:scale-98",
                          isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(date, 'EEEE, MMM d')}
                          </span>
                          {isDateToday && (
                            <span className="text-xs opacity-70">Today</span>
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
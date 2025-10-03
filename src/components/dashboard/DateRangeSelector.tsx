import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DateRangePreset = 'today' | '7days' | '30days' | 'custom';

interface DateRangeSelectorProps {
  startDate: string;
  endDate: string;
  onRangeChange: (startDate: string, endDate: string) => void;
  className?: string;
}

export function DateRangeSelector({ 
  startDate, 
  endDate, 
  onRangeChange,
  className 
}: DateRangeSelectorProps) {
  const [preset, setPreset] = React.useState<DateRangePreset>('30days');
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newStartDate: Date;
    let newEndDate: Date = today;

    switch (newPreset) {
      case 'today':
        newStartDate = today;
        break;
      case '7days':
        newStartDate = new Date(today);
        newStartDate.setDate(today.getDate() - 6);
        break;
      case '30days':
        newStartDate = new Date(today);
        newStartDate.setDate(today.getDate() - 29);
        break;
      case 'custom':
        return; // Don't auto-apply for custom
    }

    const formattedStart = format(newStartDate, 'yyyy-MM-dd');
    const formattedEnd = format(newEndDate, 'yyyy-MM-dd');
    
    console.log('[DateRangeSelector] Preset changed:', {
      preset: newPreset,
      startDate: formattedStart,
      endDate: formattedEnd,
      clientTime: new Date().toISOString()
    });

    onRangeChange(formattedStart, formattedEnd);
  };

  const handleCustomDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (!date) return;

    const formattedDate = format(date, 'yyyy-MM-dd');
    
    console.log('[DateRangeSelector] Custom date selected:', {
      type,
      selectedDate: formattedDate,
      clientTime: new Date().toISOString()
    });

    if (type === 'start') {
      onRangeChange(formattedDate, endDate);
    } else {
      onRangeChange(startDate, formattedDate);
    }
    setPreset('custom');
  };

  const getDisplayText = () => {
    if (preset === 'today') return 'Today';
    if (preset === '7days') return 'Last 7 Days';
    if (preset === '30days') return 'Last 30 Days';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const getMobileDisplayText = () => {
    if (preset === 'today') return 'Today';
    if (preset === '7days') return '7D';
    if (preset === '30days') return '30D';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
  };

  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto", className)}>
      {/* Preset Buttons - Compact on mobile */}
      <div className="flex items-center gap-1 sm:gap-2 flex-1 sm:flex-initial">
        <Button
          variant={preset === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('today')}
          className="text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 flex-1 sm:flex-initial"
        >
          <span className="hidden xs:inline">Today</span>
          <span className="inline xs:hidden">1D</span>
        </Button>
        <Button
          variant={preset === '7days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('7days')}
          className="text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 flex-1 sm:flex-initial"
        >
          7D
          <span className="hidden sm:inline">ays</span>
        </Button>
        <Button
          variant={preset === '30days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('30days')}
          className="text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 flex-1 sm:flex-initial"
        >
          30D
          <span className="hidden sm:inline">ays</span>
        </Button>
      </div>

      {/* Custom Date Range Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal min-w-0 w-auto text-xs sm:text-sm px-2 sm:px-3 h-8 sm:h-9 flex-shrink-0",
              preset === 'custom' && "border-primary"
            )}
          >
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">{getDisplayText()}</span>
            <span className="inline sm:hidden ml-1">{getMobileDisplayText()}</span>
            <ChevronDown className="ml-1 sm:ml-auto h-3 w-3 sm:h-4 sm:w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[calc(100vw-2rem)] p-0" align="end" sideOffset={5}>
          <div className="flex flex-col">
            <div className="p-2 sm:p-3 border-b">
              <div className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">Start Date</div>
              <CalendarComponent
                mode="single"
                selected={new Date(startDate)}
                onSelect={(date) => handleCustomDateChange('start', date)}
                disabled={(date) => date > new Date(endDate)}
                initialFocus
                className="pointer-events-auto scale-90 sm:scale-100 origin-top"
              />
            </div>
            <div className="p-2 sm:p-3 border-b">
              <div className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">End Date</div>
              <CalendarComponent
                mode="single"
                selected={new Date(endDate)}
                onSelect={(date) => handleCustomDateChange('end', date)}
                disabled={(date) => date < new Date(startDate) || date > new Date()}
                className="pointer-events-auto scale-90 sm:scale-100 origin-top"
              />
            </div>
          </div>
          <div className="p-2 sm:p-3 border-t flex justify-end gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePresetChange('30days');
                setIsOpen(false);
              }}
              className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4"
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Preset Buttons */}
      <div className="hidden sm:flex items-center gap-2">
        <Button
          variant={preset === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('today')}
        >
          Today
        </Button>
        <Button
          variant={preset === '7days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('7days')}
        >
          7 Days
        </Button>
        <Button
          variant={preset === '30days' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetChange('30days')}
        >
          30 Days
        </Button>
      </div>

      {/* Custom Date Range Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal min-w-[200px]",
              preset === 'custom' && "border-primary"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {getDisplayText()}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="p-3 border-b sm:border-b-0 sm:border-r">
              <div className="text-sm font-medium mb-2">Start Date</div>
              <CalendarComponent
                mode="single"
                selected={new Date(startDate)}
                onSelect={(date) => handleCustomDateChange('start', date)}
                disabled={(date) => date > new Date(endDate)}
                initialFocus
                className="pointer-events-auto"
              />
            </div>
            <div className="p-3">
              <div className="text-sm font-medium mb-2">End Date</div>
              <CalendarComponent
                mode="single"
                selected={new Date(endDate)}
                onSelect={(date) => handleCustomDateChange('end', date)}
                disabled={(date) => date < new Date(startDate) || date > new Date()}
                className="pointer-events-auto"
              />
            </div>
          </div>
          <div className="p-3 border-t flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handlePresetChange('30days');
                setIsOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

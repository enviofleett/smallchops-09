import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarX, Plus, X, CalendarIcon, AlertTriangle } from 'lucide-react';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';
import { cn } from '@/lib/utils';

interface DisabledDatesSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

export const DisabledDatesSection = ({ form }: DisabledDatesSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const disabledDates = form.watch('disabled_calendar_dates') || [];
  const today = startOfDay(new Date());

  const addDate = (date: Date | undefined) => {
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const currentDates = form.getValues('disabled_calendar_dates') || [];
    
    if (currentDates.includes(dateStr)) {
      return; // Already exists
    }
    
    form.setValue('disabled_calendar_dates', [...currentDates, dateStr].sort());
    setIsOpen(false);
  };

  const removeDate = (dateStr: string) => {
    const currentDates = form.getValues('disabled_calendar_dates') || [];
    form.setValue(
      'disabled_calendar_dates',
      currentDates.filter((d) => d !== dateStr)
    );
  };

  const clearAllDates = () => {
    form.setValue('disabled_calendar_dates', []);
  };

  // Separate past and future dates
  const pastDates = disabledDates.filter((dateStr) => 
    isBefore(parseISO(dateStr), today)
  );
  const futureDates = disabledDates.filter((dateStr) => 
    !isBefore(parseISO(dateStr), today)
  );

  // Dates to disable in the calendar picker (already selected dates)
  const disabledCalendarDates = disabledDates.map((dateStr) => parseISO(dateStr));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarX className="h-5 w-5" />
          Disabled Delivery Dates
        </CardTitle>
        <CardDescription>
          Block specific dates from delivery and pickup. Customers will not be able to select these dates during checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Date Button */}
        <div className="flex flex-wrap gap-3 items-center">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Disabled Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={addDate}
                disabled={(date) => 
                  isBefore(date, today) || 
                  disabledCalendarDates.some((d) => 
                    format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                  )
                }
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {disabledDates.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllDates}
              className="text-destructive hover:text-destructive"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Future Disabled Dates */}
        {futureDates.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Upcoming Disabled Dates ({futureDates.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {futureDates.map((dateStr) => (
                <Badge 
                  key={dateStr} 
                  variant="secondary"
                  className="gap-1.5 py-1.5 px-3 text-sm"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(parseISO(dateStr), 'MMM d, yyyy')}
                  <button
                    type="button"
                    onClick={() => removeDate(dateStr)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Past Disabled Dates (Collapsible) */}
        {pastDates.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Past Dates ({pastDates.length})
              </h4>
              <Badge variant="outline" className="text-xs">
                Can be removed
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {pastDates.map((dateStr) => (
                <Badge 
                  key={dateStr} 
                  variant="outline"
                  className="gap-1.5 py-1.5 px-3 text-sm text-muted-foreground"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {format(parseISO(dateStr), 'MMM d, yyyy')}
                  <button
                    type="button"
                    onClick={() => removeDate(dateStr)}
                    className="ml-1 hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {disabledDates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg">
            <CalendarX className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No dates disabled
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add dates to prevent customers from scheduling deliveries on those days.
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="flex gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Important
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Disabled dates apply to all delivery and pickup options. Customers will see these dates as unavailable in the checkout calendar. Existing orders on these dates will not be affected.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

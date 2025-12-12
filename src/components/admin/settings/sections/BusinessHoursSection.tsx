import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Clock } from 'lucide-react';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';

interface BusinessHoursSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

const days = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

export const BusinessHoursSection = ({ form }: BusinessHoursSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Business Hours
        </CardTitle>
        <CardDescription>
          Set your operating hours for each day of the week. These hours affect delivery availability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4 text-sm font-medium text-muted-foreground pb-2 border-b">
            <div>Day</div>
            <div>Open</div>
            <div>Close</div>
            <div>Status</div>
          </div>

          {days.map((day) => (
            <div key={day.key} className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 items-center py-2 border-b border-border/50 last:border-0">
              <div className="font-medium sm:font-normal">{day.label}</div>
              
              <FormField
                control={form.control}
                name={`business_hours.${day.key}.open`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 sm:block">
                    <FormLabel className="sm:hidden text-muted-foreground w-16 shrink-0">Open:</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="time"
                        className="bg-background h-9"
                        disabled={!form.watch(`business_hours.${day.key}.is_open`)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name={`business_hours.${day.key}.close`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 sm:block">
                    <FormLabel className="sm:hidden text-muted-foreground w-16 shrink-0">Close:</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        type="time"
                        className="bg-background h-9"
                        disabled={!form.watch(`business_hours.${day.key}.is_open`)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name={`business_hours.${day.key}.is_open`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 sm:justify-start">
                    <FormLabel className="sm:hidden text-muted-foreground w-16 shrink-0">Open:</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                        <span className={`text-sm ${field.value ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {field.value ? 'Open' : 'Closed'}
                        </span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

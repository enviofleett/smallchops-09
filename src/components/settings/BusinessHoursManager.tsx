import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BusinessHoursData {
  [key: string]: {
    open: string;
    close: string;
    is_open: boolean;
  };
}

interface BusinessHoursManagerProps {
  form: UseFormReturn<any>;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

export const BusinessHoursManager: React.FC<BusinessHoursManagerProps> = ({ form }) => {
  const businessHours = form.watch('business_hours') || {};
  
  const validateTimeRange = (open: string, close: string) => {
    if (!open || !close) return true;
    const [openHour, openMin] = open.split(':').map(Number);
    const [closeHour, closeMin] = close.split(':').map(Number);
    const openTime = openHour * 60 + openMin;
    const closeTime = closeHour * 60 + closeMin;
    return openTime < closeTime;
  };

  const formatTimeRange = (day: any) => {
    if (!day?.is_open) return 'Closed';
    if (!day?.open || !day?.close) return 'Not set';
    return `${day.open} - ${day.close}`;
  };

  const getOpenDaysCount = () => {
    return DAYS_OF_WEEK.filter(day => businessHours[day.key]?.is_open).length;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Business Hours & Delivery Schedule
        </CardTitle>
        <div className="flex flex-col sm:flex-row gap-2">
          <Badge variant="secondary">
            {getOpenDaysCount()} days open
          </Badge>
          <Badge variant="outline">
            Affects delivery scheduling
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            These hours determine when customers can schedule deliveries. Delivery slots will only be available during business hours with appropriate lead time.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => {
            const dayData = businessHours[day.key] || { open: '09:00', close: '21:00', is_open: true };
            const hasTimeError = dayData.is_open && !validateTimeRange(dayData.open, dayData.close);
            
            return (
              <div key={day.key} className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 border rounded-lg">
                {/* Day name and toggle */}
                <div className="lg:col-span-3 flex items-center justify-between lg:flex-col lg:items-start gap-2">
                  <div>
                    <h4 className="font-medium">{day.label}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatTimeRange(dayData)}
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name={`business_hours.${day.key}.is_open`}
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          {field.value ? 'Open' : 'Closed'}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Time inputs */}
                {dayData.is_open && (
                  <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`business_hours.${day.key}.open`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Opening Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              value={field.value || '09:00'}
                              className={hasTimeError ? "border-destructive" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`business_hours.${day.key}.close`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Closing Time</FormLabel>
                          <FormControl>
                            <Input
                              type="time"
                              {...field}
                              value={field.value || '21:00'}
                              className={hasTimeError ? "border-destructive" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                          {hasTimeError && (
                            <p className="text-sm text-destructive">
                              Closing time must be after opening time
                            </p>
                          )}
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <FormDescription>
            Customers will only be able to schedule deliveries during these business hours. 
            A minimum lead time of 90 minutes is enforced for all delivery bookings.
          </FormDescription>
        </div>
      </CardContent>
    </Card>
  );
};
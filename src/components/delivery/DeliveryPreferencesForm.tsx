import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DeliveryPreferences, getDeliveryPreferences, upsertDeliveryPreferences } from '@/api/deliveryPreferences';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Clock, Phone, Mail, Calendar } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export function DeliveryPreferencesForm() {
  const { customerAccount } = useCustomerAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<DeliveryPreferences | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<DeliveryPreferences>({
    defaultValues: {
      notifications_enabled: true,
      sms_notifications: false,
      email_notifications: true,
      preferred_days: [],
    }
  });

  const preferredDays = watch('preferred_days') || [];

  useEffect(() => {
    if (customerAccount) {
      loadPreferences();
    }
  }, [customerAccount]);

  const loadPreferences = async () => {
    if (!customerAccount) return;

    try {
      setLoading(true);
      const data = await getDeliveryPreferences(customerAccount.id);
      if (data) {
        setPreferences(data);
        // Set form values
        Object.keys(data).forEach((key) => {
          setValue(key as keyof DeliveryPreferences, data[key as keyof DeliveryPreferences]);
        });
      }
    } catch (error: any) {
      console.error('Error loading preferences:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load delivery preferences"
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: DeliveryPreferences) => {
    if (!customerAccount) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to save preferences"
      });
      return;
    }

    try {
      setLoading(true);
      
      const preferencesData = {
        ...data,
        customer_id: customerAccount.id,
      };

      await upsertDeliveryPreferences(preferencesData);
      
      toast({
        title: "Success",
        description: "Your delivery preferences have been saved"
      });
      
      // Reload preferences to get updated data
      await loadPreferences();
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save delivery preferences"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDayToggle = (day: string, checked: boolean) => {
    const currentDays = preferredDays || [];
    if (checked) {
      setValue('preferred_days', [...currentDays, day]);
    } else {
      setValue('preferred_days', currentDays.filter(d => d !== day));
    }
  };

  if (!customerAccount) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            Please log in to manage your delivery preferences.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Delivery Preferences
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Preferred Delivery Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_delivery_time_start">Preferred Start Time</Label>
              <Input
                id="preferred_delivery_time_start"
                type="time"
                {...register('preferred_delivery_time_start')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_delivery_time_end">Preferred End Time</Label>
              <Input
                id="preferred_delivery_time_end"
                type="time"
                {...register('preferred_delivery_time_end')}
              />
            </div>
          </div>

          {/* Preferred Days */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Preferred Delivery Days
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={day.value}
                    checked={preferredDays.includes(day.value)}
                    onCheckedChange={(checked) => handleDayToggle(day.value, checked as boolean)}
                  />
                  <Label htmlFor={day.value} className="text-sm">
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Contact Phone
              </Label>
              <Input
                id="contact_phone"
                type="tel"
                placeholder="+234 800 123 4567"
                {...register('contact_phone')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Email
              </Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="your@email.com"
                {...register('contact_email')}
              />
            </div>
          </div>

          {/* Delivery Instructions */}
          <div className="space-y-2">
            <Label htmlFor="delivery_instructions">Special Delivery Instructions</Label>
            <Textarea
              id="delivery_instructions"
              placeholder="e.g., Ring doorbell twice, Leave at security gate, etc."
              {...register('delivery_instructions')}
            />
          </div>

          {/* Notification Preferences */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Notification Preferences</Label>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifications_enabled"
                  {...register('notifications_enabled')}
                />
                <Label htmlFor="notifications_enabled">
                  Enable delivery notifications
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email_notifications"
                  {...register('email_notifications')}
                />
                <Label htmlFor="email_notifications">
                  Email notifications
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sms_notifications"
                  {...register('sms_notifications')}
                />
                <Label htmlFor="sms_notifications">
                  SMS notifications
                </Label>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
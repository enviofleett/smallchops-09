import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { format } from 'date-fns';
import { Calendar, Clock, Edit2, Save, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { updateDeliverySchedule, upsertDeliverySchedule, type CreateDeliverySchedule } from '@/api/deliveryScheduleApi';

// Production-ready validation schema
const pickupScheduleSchema = z.object({
  delivery_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .refine((date) => {
      const parsedDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return parsedDate >= today;
    }, 'Pickup date cannot be in the past'),
  delivery_time_start: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  delivery_time_end: z.string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  is_flexible: z.boolean().optional(),
  special_instructions: z.string()
    .max(500, 'Instructions must be less than 500 characters')
    .trim()
    .optional()
}).refine((data) => {
  const start = new Date(`1970-01-01T${data.delivery_time_start}`);
  const end = new Date(`1970-01-01T${data.delivery_time_end}`);
  return start < end;
}, {
  message: 'End time must be after start time',
  path: ['delivery_time_end']
});

interface PickupScheduleUpdateProps {
  orderId: string;
  currentSchedule?: any;
  onUpdate?: () => void;
}

export const PickupScheduleUpdate: React.FC<PickupScheduleUpdateProps> = ({
  orderId,
  currentSchedule,
  onUpdate
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    delivery_date: currentSchedule?.delivery_date || format(new Date(), 'yyyy-MM-dd'),
    delivery_time_start: currentSchedule?.delivery_time_start || '16:00',
    delivery_time_end: currentSchedule?.delivery_time_end || '17:00',
    is_flexible: currentSchedule?.is_flexible || false,
    special_instructions: currentSchedule?.special_instructions || ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data: CreateDeliverySchedule) => {
      // Server-side validation
      const validated = pickupScheduleSchema.parse(data);
      
      const scheduleData: CreateDeliverySchedule = {
        order_id: orderId,
        delivery_date: validated.delivery_date,
        delivery_time_start: validated.delivery_time_start,
        delivery_time_end: validated.delivery_time_end,
        is_flexible: validated.is_flexible,
        special_instructions: validated.special_instructions
      };

      if (currentSchedule?.id) {
        return updateDeliverySchedule(currentSchedule.id, scheduleData);
      } else {
        return upsertDeliverySchedule(scheduleData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-order'] });
      toast({
        title: 'Pickup Schedule Updated',
        description: 'The pickup schedule has been successfully updated.',
      });
      setIsEditing(false);
      onUpdate?.();
    },
    onError: (error: any) => {
      console.error('Pickup schedule update failed:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update pickup schedule. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const handleSave = () => {
    try {
      // Client-side validation
      setErrors({});
      const validated = pickupScheduleSchema.parse(formData);
      
      const scheduleData: CreateDeliverySchedule = {
        order_id: orderId,
        delivery_date: validated.delivery_date,
        delivery_time_start: validated.delivery_time_start,
        delivery_time_end: validated.delivery_time_end,
        is_flexible: validated.is_flexible,
        special_instructions: validated.special_instructions
      };
      
      updateMutation.mutate(scheduleData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      delivery_date: currentSchedule?.delivery_date || format(new Date(), 'yyyy-MM-dd'),
      delivery_time_start: currentSchedule?.delivery_time_start || '16:00',
      delivery_time_end: currentSchedule?.delivery_time_end || '17:00',
      is_flexible: currentSchedule?.is_flexible || false,
      special_instructions: currentSchedule?.special_instructions || ''
    });
    setErrors({});
    setIsEditing(false);
  };

  const formatTimeForDisplay = (time: string) => {
    try {
      return format(new Date(`1970-01-01T${time}`), 'h:mm a');
    } catch {
      return time;
    }
  };

  const getBusinessDay = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'EEEE');
    } catch {
      return 'Invalid Date';
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-4 border border-primary/20 rounded-lg p-4 bg-primary/5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-primary">Update Pickup Schedule</h4>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="h-7"
            >
              <Save className="w-3 h-3 mr-1" />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              className="h-7"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-date" className="text-xs">Pickup Date</Label>
            <Input
              id="pickup-date"
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
              className="h-8 text-xs"
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            {errors.delivery_date && (
              <p className="text-xs text-destructive">{errors.delivery_date}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-day" className="text-xs">Business Day</Label>
            <Input
              id="business-day"
              value={getBusinessDay(formData.delivery_date)}
              readOnly
              className="h-8 text-xs bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-time" className="text-xs">Start Time</Label>
            <Input
              id="start-time"
              type="time"
              value={formData.delivery_time_start}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_time_start: e.target.value }))}
              className="h-8 text-xs"
            />
            {errors.delivery_time_start && (
              <p className="text-xs text-destructive">{errors.delivery_time_start}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="end-time" className="text-xs">End Time</Label>
            <Input
              id="end-time"
              type="time"
              value={formData.delivery_time_end}
              onChange={(e) => setFormData(prev => ({ ...prev, delivery_time_end: e.target.value }))}
              className="h-8 text-xs"
            />
            {errors.delivery_time_end && (
              <p className="text-xs text-destructive">{errors.delivery_time_end}</p>
            )}
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="special-instructions" className="text-xs">Special Instructions (Optional)</Label>
            <Input
              id="special-instructions"
              value={formData.special_instructions}
              onChange={(e) => setFormData(prev => ({ ...prev, special_instructions: e.target.value.trim() }))}
              placeholder="Any special pickup instructions..."
              maxLength={500}
              className="h-8 text-xs"
            />
            {errors.special_instructions && (
              <p className="text-xs text-destructive">{errors.special_instructions}</p>
            )}
          </div>
        </div>

        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Please correct the errors above before saving.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-primary">Pickup Schedule Fulfillment</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsEditing(true)}
          className="h-7"
        >
          <Edit2 className="w-3 h-3 mr-1" />
          Update
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Channel */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Channel:</span>
          <div className="font-semibold text-primary">Pickup</div>
        </div>
        
        {/* Pickup Date */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Pickup Date:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_date ? (
              <div className="space-y-1">
                <div>
                  {format(new Date(currentSchedule.delivery_date), 'MMM d, yyyy') === format(new Date(), 'MMM d, yyyy') 
                    ? 'Today' 
                    : format(new Date(currentSchedule.delivery_date), 'MMM d, yyyy')
                  }
                </div>
                <div className="text-xs text-muted-foreground font-normal">
                  {format(new Date(currentSchedule.delivery_date), 'EEEE, MMMM do, yyyy')}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div>Today</div>
                <div className="text-xs text-muted-foreground font-normal">
                  {format(new Date(), 'EEEE, MMMM do, yyyy')}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Pickup Time Window */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Pickup Time Window:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_time_start && currentSchedule?.delivery_time_end ? (
              <>
                {formatTimeForDisplay(currentSchedule.delivery_time_start)} – {formatTimeForDisplay(currentSchedule.delivery_time_end)}
                <span className="ml-2">⏰ Upcoming window</span>
              </>
            ) : (
              <>
                4:00 PM – 5:00 PM
                <span className="ml-2">⏰ Default window</span>
              </>
            )}
          </div>
        </div>
        
        {/* Business Day */}
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">Business Day:</span>
          <div className="font-semibold">
            {currentSchedule?.delivery_date ? 
              format(new Date(currentSchedule.delivery_date), 'EEEE') : 
              format(new Date(), 'EEEE')
            }
          </div>
        </div>
      </div>
    </div>
  );
};
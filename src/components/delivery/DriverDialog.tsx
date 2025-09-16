import React from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import type { Driver, NewDriver } from '@/api/drivers';

interface DriverDialogProps {
  driver?: Driver | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: NewDriver) => Promise<void>;
}

export const DriverDialog = ({ driver, open, onOpenChange, onSave }: DriverDialogProps) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const form = useForm<NewDriver>({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      license_number: '',
      vehicle_type: 'car',
      vehicle_brand: '',
      vehicle_model: '',
      license_plate: '',
      is_active: true,
    },
  });

  // Reset form when driver prop changes or dialog opens/closes
  React.useEffect(() => {
    if (open) {
      form.reset({
        name: driver?.name || '',
        phone: driver?.phone || '',
        email: driver?.email || '',
        license_number: driver?.license_number || '',
        vehicle_type: driver?.vehicle_type || 'car',
        vehicle_brand: driver?.vehicle_brand || '',
        vehicle_model: driver?.vehicle_model || '',
        license_plate: driver?.license_plate || '',
        is_active: driver?.is_active ?? true,
      });
    }
  }, [driver, open, form]);

  const handleSubmit = async (data: NewDriver) => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      console.log('🔄 Submitting driver data:', data);
      
      // Client-side validation
      if (!data.name?.trim()) {
        toast.error('Driver name is required');
        return;
      }
      
      if (!data.phone?.trim()) {
        toast.error('Driver phone number is required');
        return;
      }

      // Validate email format if provided
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        toast.error('Please enter a valid email address');
        return;
      }

      // Clean up the data
      const cleanData: NewDriver = {
        ...data,
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || undefined,
        license_number: data.license_number?.trim() || undefined,
        vehicle_brand: data.vehicle_brand?.trim() || undefined,
        vehicle_model: data.vehicle_model?.trim() || undefined,
        license_plate: data.license_plate?.trim() || undefined,
      };

      await onSave(cleanData);
      form.reset();
      onOpenChange(false);
      console.log('✅ Driver saved successfully');
    } catch (error) {
      console.error('❌ Error saving driver:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save driver';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {driver ? 'Edit Driver' : 'Add New Driver'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} required />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <Input {...field} type="tel" required />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="license_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Number</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicle_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle Type *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vehicle type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="bicycle">Bicycle</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vehicle_model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="license_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Plate</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Driver is available for assignments
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose} 
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : (driver ? 'Update' : 'Create')} Driver
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
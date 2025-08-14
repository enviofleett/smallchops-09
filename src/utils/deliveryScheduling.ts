import { supabase } from '@/integrations/supabase/client';
import { addMinutes, isBefore, isAfter, startOfDay, addDays, isSameDay } from 'date-fns';
import { format, parseISO } from 'date-fns';

export interface BusinessHours {
  open: string;
  close: string;
  is_open: boolean;
}

export interface DeliverySchedulingConfig {
  minimum_lead_time_minutes: number;
  max_advance_booking_days: number;
  default_delivery_duration_minutes: number;
  allow_same_day_delivery: boolean;
  business_hours: {
    monday: BusinessHours;
    tuesday: BusinessHours;
    wednesday: BusinessHours;
    thursday: BusinessHours;
    friday: BusinessHours;
    saturday: BusinessHours;
    sunday: BusinessHours;
  };
}

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  description?: string;
}

export interface DeliveryTimeSlot {
  slot_id?: string;
  start_time: string;
  end_time: string;
  available: boolean;
  available_spots?: number;
  max_capacity?: number;
  current_bookings?: number;
  reason?: string;
}

export interface DeliverySlot {
  date: string;
  time_slots: DeliveryTimeSlot[];
  is_holiday: boolean;
  holiday_name?: string;
  is_business_day: boolean;
}

class DeliverySchedulingService {
  private config: DeliverySchedulingConfig | null = null;
  private holidays: PublicHoliday[] = [];

  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.loadConfiguration(),
        this.loadHolidays()
      ]);
    } catch (error) {
      console.error('Failed to initialize delivery scheduling service:', error);
      // Use default config to ensure service remains functional
      this.config = this.getDefaultConfig();
      this.holidays = [];
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('delivery_scheduling_config, business_hours')
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is acceptable
        throw error;
      }

      // Merge business hours from settings with delivery config
      let config = (data?.delivery_scheduling_config as unknown as DeliverySchedulingConfig) || this.getDefaultConfig();
      
      // Use business hours from database if available
      if (data?.business_hours) {
        config.business_hours = data.business_hours as any;
      }

      this.config = config;
    } catch (error) {
      console.error('Failed to load delivery scheduling config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  private async loadHolidays(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('public_holidays')
        .select('*')
        .eq('is_active', true)
        .gte('date', format(new Date(), 'yyyy-MM-dd')); // Only future holidays

      if (error && error.code !== 'PGRST116') { // Not found is acceptable
        throw error;
      }
      
      this.holidays = data || [];
    } catch (error) {
      console.error('Failed to load holidays:', error);
      this.holidays = [];
    }
  }

  private getDefaultConfig(): DeliverySchedulingConfig {
    return {
      minimum_lead_time_minutes: 90,
      max_advance_booking_days: 30,
      default_delivery_duration_minutes: 60, // Changed to 1 hour slots
      allow_same_day_delivery: true,
      business_hours: {
        monday: { open: '08:00', close: '18:00', is_open: true }, // 8 AM - 6 PM
        tuesday: { open: '08:00', close: '18:00', is_open: true },
        wednesday: { open: '08:00', close: '18:00', is_open: true },
        thursday: { open: '08:00', close: '18:00', is_open: true },
        friday: { open: '08:00', close: '18:00', is_open: true },
        saturday: { open: '08:00', close: '18:00', is_open: true },
        sunday: { open: '10:00', close: '18:00', is_open: false }, // Closed Sundays
      }
    };
  }

  getMinimumDeliveryTime(): Date {
    if (!this.config) {
      console.warn('Delivery config not loaded, using default 90 minutes');
      return addMinutes(new Date(), 90);
    }
    return addMinutes(new Date(), this.config.minimum_lead_time_minutes);
  }

  getMaximumDeliveryDate(): Date {
    if (!this.config) {
      console.warn('Delivery config not loaded, using default 30 days');
      return addDays(new Date(), 30);
    }
    return addDays(new Date(), this.config.max_advance_booking_days);
  }

  isDateAvailable(date: Date): { available: boolean; reason?: string } {
    if (!this.config) return { available: false, reason: 'Configuration not loaded' };

    // Check if date is too soon
    const minDeliveryTime = this.getMinimumDeliveryTime();
    if (isBefore(date, startOfDay(minDeliveryTime))) {
      return { 
        available: false, 
        reason: `Minimum ${this.config.minimum_lead_time_minutes} minutes lead time required` 
      };
    }

    // Check if date is too far in advance
    const maxDeliveryDate = this.getMaximumDeliveryDate();
    if (isAfter(date, maxDeliveryDate)) {
      return { 
        available: false, 
        reason: `Cannot book more than ${this.config.max_advance_booking_days} days in advance` 
      };
    }

    // Check if it's a holiday
    const dateStr = format(date, 'yyyy-MM-dd');
    const holiday = this.holidays.find(h => h.date === dateStr);
    if (holiday) {
      return { 
        available: false, 
        reason: `${holiday.name} - No delivery available` 
      };
    }

    // Check if it's a business day
    const dayOfWeek = format(date, 'EEEE').toLowerCase() as keyof typeof this.config.business_hours;
    const businessHours = this.config.business_hours[dayOfWeek];
    if (!businessHours.is_open) {
      return { 
        available: false, 
        reason: 'Store closed on this day' 
      };
    }

    return { available: true };
  }

  async generateTimeSlots(date: Date): Promise<DeliveryTimeSlot[]> {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Get available slots from database
      const { data, error } = await supabase
        .rpc('get_available_delivery_slots', {
          p_start_date: dateStr,
          p_end_date: dateStr
        });

      if (error) {
        console.error('Error fetching delivery slots:', error);
        return [];
      }

      const minDeliveryTime = this.getMinimumDeliveryTime();
      
      return (data || []).map((slot: any) => {
        const slotDateTime = new Date(`${slot.date}T${slot.start_time}`);
        const isPastDeadline = isBefore(slotDateTime, minDeliveryTime);
        const isAvailable = slot.is_available && !isPastDeadline;
        
        return {
          slot_id: slot.slot_id,
          start_time: slot.start_time.slice(0, 5), // Format as HH:mm
          end_time: slot.end_time.slice(0, 5),
          available: isAvailable,
          available_spots: slot.available_spots,
          max_capacity: slot.max_capacity,
          current_bookings: slot.current_bookings,
          reason: !isAvailable 
            ? (isPastDeadline ? 'Too soon - minimum lead time required' : 'Slot fully booked')
            : undefined
        };
      });
    } catch (error) {
      console.error('Failed to generate time slots:', error);
      return [];
    }
  }

  private parseTime(timeStr: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private combineDateAndTime(date: Date, time: Date): Date {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  }

  async getAvailableDeliverySlots(startDate?: Date, endDate?: Date): Promise<DeliverySlot[]> {
    try {
      await this.initialize();

      const start = startDate || new Date();
      const end = endDate || this.getMaximumDeliveryDate();
      const slots: DeliverySlot[] = [];

      let currentDate = startOfDay(start);
      const maxIterations = 100; // Prevent infinite loops
      let iterations = 0;

      while (!isAfter(currentDate, end) && iterations < maxIterations) {
        const availability = this.isDateAvailable(currentDate);
        const holiday = this.holidays.find(h => h.date === format(currentDate, 'yyyy-MM-dd'));
        
        const slot: DeliverySlot = {
          date: format(currentDate, 'yyyy-MM-dd'),
          time_slots: availability.available ? await this.generateTimeSlots(currentDate) : [],
          is_holiday: !!holiday,
          holiday_name: holiday?.name,
          is_business_day: availability.available
        };

        slots.push(slot);
        currentDate = addDays(currentDate, 1);
        iterations++;
      }

      return slots;
    } catch (error) {
      console.error('Failed to get available delivery slots:', error);
      return [];
    }
  }

  async validateDeliverySlot(date: string, startTime: string, endTime: string): Promise<{ valid: boolean; error?: string }> {
    if (!this.config) return { valid: false, error: 'Configuration not loaded' };

    const deliveryDate = parseISO(date);
    const availability = this.isDateAvailable(deliveryDate);
    
    if (!availability.available) {
      return { valid: false, error: availability.reason };
    }

    const timeSlots = await this.generateTimeSlots(deliveryDate);
    const selectedSlot = timeSlots.find(slot => 
      slot.start_time === startTime && slot.end_time === endTime
    );

    if (!selectedSlot) {
      return { valid: false, error: 'Invalid time slot' };
    }

    if (!selectedSlot.available) {
      return { valid: false, error: selectedSlot.reason || 'Time slot not available' };
    }

    return { valid: true };
  }

  // New method to reserve a delivery slot
  async reserveDeliverySlot(slotId: string, orderId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('reserve_delivery_slot', {
        p_slot_id: slotId,
        p_order_id: orderId || null
      });

      if (error) throw error;
      
      return (data as any)?.success 
        ? { success: true }
        : { success: false, error: (data as any)?.error };
    } catch (error) {
      console.error('Failed to reserve delivery slot:', error);
      return { success: false, error: 'Failed to reserve slot' };
    }
  }

  // New method to release a delivery slot
  async releaseDeliverySlot(slotId: string, orderId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('release_delivery_slot', {
        p_slot_id: slotId,
        p_order_id: orderId || null
      });

      if (error) throw error;
      
      return (data as any)?.success 
        ? { success: true }
        : { success: false, error: (data as any)?.error };
    } catch (error) {
      console.error('Failed to release delivery slot:', error);
      return { success: false, error: 'Failed to release slot' };
    }
  }
}

export const deliverySchedulingService = new DeliverySchedulingService();
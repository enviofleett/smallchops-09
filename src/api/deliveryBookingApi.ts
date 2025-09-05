import { supabase } from '@/integrations/supabase/client';

// Interface definitions
export interface DeliverySlot {
  date: string;
  is_business_day: boolean;
  is_holiday: boolean;
  holiday_name?: string;
  time_slots: TimeSlot[];
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
  reason?: string;
  capacity?: number;
  booked_count?: number;
}

export interface DeliveryAvailabilityRequest {
  start_date: string;
  end_date: string;
  customer_id?: string;
}

export interface DeliveryAvailabilityResponse {
  success: boolean;
  slots: DeliverySlot[];
  total_days: number;
  business_days: number;
}

export interface DeliveryBookingRequest {
  customer_id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  address: {
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    latitude?: number;
    longitude?: number;
  };
  order_id?: string;
  special_instructions?: string;
  contact_phone?: string;
}

export interface DeliveryBookingResponse {
  success: boolean;
  booking?: any;
  message: string;
  confirmation_number?: string;
  error?: string;
}

/**
 * Production-ready delivery availability API
 * Supports 6-month advance booking with proper validation
 */
export class DeliveryBookingAPI {
  private static instance: DeliveryBookingAPI;
  
  public static getInstance(): DeliveryBookingAPI {
    if (!DeliveryBookingAPI.instance) {
      DeliveryBookingAPI.instance = new DeliveryBookingAPI();
    }
    return DeliveryBookingAPI.instance;
  }

  /**
   * Get available delivery slots for a date range (up to 6 months)
   */
  async getAvailableSlots(params: DeliveryAvailabilityRequest): Promise<DeliveryAvailabilityResponse> {
    try {
      console.log('🚚 Fetching delivery availability:', params);

      const { data, error } = await supabase.functions.invoke('delivery-availability', {
        body: params
      });

      if (error) {
        console.error('❌ Delivery availability error:', error);
        throw new Error(error.message || 'Failed to fetch delivery availability');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch delivery slots');
      }

      console.log('✅ Delivery slots received:', data.slots.length, 'slots');
      return data;

    } catch (error) {
      console.error('❌ API Error in getAvailableSlots:', error);
      throw error;
    }
  }

  /**
   * Create a new delivery booking
   */
  async createBooking(booking: DeliveryBookingRequest): Promise<DeliveryBookingResponse> {
    try {
      console.log('📦 Creating delivery booking:', booking);

      const { data, error } = await supabase.functions.invoke('delivery-booking', {
        body: booking
      });

      if (error) {
        console.error('❌ Delivery booking error:', error);
        throw new Error(error.message || 'Failed to create delivery booking');
      }

      if (!data.success) {
        console.log('❌ Booking failed:', data.error);
        return {
          success: false,
          message: data.error || 'Failed to create booking',
          error: data.error
        };
      }

      console.log('✅ Booking created successfully:', data.confirmation_number);
      return data;

    } catch (error) {
      console.error('❌ API Error in createBooking:', error);
      throw error;
    }
  }

  /**
   * Get existing bookings for a customer
   */
  async getCustomerBookings(customerId: string): Promise<any[]> {
    try {
      console.log('📋 Fetching customer bookings for:', customerId);

      const { data, error } = await supabase.functions.invoke('delivery-booking', {
        body: null,
        method: 'GET'
      });

      if (error) {
        console.error('❌ Error fetching bookings:', error);
        throw new Error(error.message || 'Failed to fetch bookings');
      }

      return data.bookings || [];

    } catch (error) {
      console.error('❌ API Error in getCustomerBookings:', error);
      throw error;
    }
  }

  /**
   * Validate date range for 2-month booking window
   */
  validateDateRange(startDate: Date, endDate: Date): { valid: boolean; error?: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);
    
    if (startDate < today) {
      return { valid: false, error: 'Start date cannot be in the past' };
    }
    
    if (endDate > maxDate) {
      return { valid: false, error: 'End date cannot be more than 2 months in advance' };
    }
    
    if (startDate > endDate) {
      return { valid: false, error: 'Start date must be before end date' };
    }
    
    return { valid: true };
  }

  /**
   * Helper method to format dates for API calls
   */
  formatDateForAPI(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get the maximum booking date (2 months from now)
   */
  getMaxBookingDate(): Date {
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2);
    return maxDate;
  }

  /**
   * Get the minimum booking date (tomorrow)
   */
  getMinBookingDate(): Date {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  }
}

// Export singleton instance
export const deliveryBookingAPI = DeliveryBookingAPI.getInstance();
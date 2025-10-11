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
  total_slots: number;
  available_slots: number;
  config: {
    lead_time_minutes: number;
    max_advance_days: number;
    slot_duration_minutes: number;
  };
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
        
        // Detect HTML error responses (function not deployed or server error)
        const errorStr = typeof error === 'string' ? error : error.message || '';
        if (errorStr.includes('<!DOCTYPE') || errorStr.includes('<html')) {
          throw new Error('Delivery scheduling service is temporarily unavailable. Please try again later.');
        }
        
        throw new Error(error.message || 'Failed to fetch delivery availability');
      }

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from delivery service. Please refresh and try again.');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch delivery slots');
      }

      console.log('✅ Delivery slots received:', data.slots?.length || 0, 'slots');
      return data;

    } catch (error) {
      console.error('❌ API Error in getAvailableSlots:', error);
      
      // Provide user-friendly error messages
      if (error instanceof Error) {
        if (error.message.includes('MIME type')) {
          throw new Error('Service temporarily unavailable. Please refresh the page and try again.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Create a new delivery booking - REMOVED: Function not implemented
   * This functionality has been moved to direct order processing
   */
  // createBooking method removed - delivery bookings are handled through order creation

  /**
   * Get existing bookings for a customer - REMOVED: Function not implemented  
   * This functionality is available through the orders API
   */
  // getCustomerBookings method removed - use orders API instead

  /**
   * Validate date range for production booking window (60 days)
   */
  validateDateRange(startDate: Date, endDate: Date): { valid: boolean; error?: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60); // Production: 60 days advance booking
    
    if (startDate < today) {
      return { valid: false, error: 'Start date cannot be in the past' };
    }
    
    if (endDate > maxDate) {
      return { valid: false, error: 'End date cannot be more than 60 days in advance' };
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
   * Get the maximum booking date (60 days from now)
   */
  getMaxBookingDate(): Date {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60); // Production: 60 days advance booking
    return maxDate;
  }

  /**
   * Get the minimum booking date (today with lead time)
   */
  getMinBookingDate(): Date {
    const minDate = new Date();
    minDate.setHours(0, 0, 0, 0);
    return minDate;
  }
}

// Export singleton instance
export const deliveryBookingAPI = DeliveryBookingAPI.getInstance();
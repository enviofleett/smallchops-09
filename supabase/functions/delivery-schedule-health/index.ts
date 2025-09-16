import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessSettings {
  business_hours?: any;
  delivery_scheduling_config?: any;
  is_open: boolean;
  holiday_mode?: boolean;
}

interface DeliveryHealthResponse {
  healthy: boolean;
  delivery_available: boolean;
  current_time: string;
  business_status: 'open' | 'closed' | 'holiday';
  next_available_slot: string | null;
  delivery_hours: {
    start: string;
    end: string;
  };
  lead_time_minutes: number;
  issues: string[];
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const now = new Date();
    const currentTime = now.toISOString();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Get business settings
    const { data: settings, error: settingsError } = await supabase
      .from('business_settings')
      .select('business_hours, delivery_scheduling_config, is_open, holiday_mode')
      .single();

    if (settingsError) {
      issues.push('Unable to load business settings');
      console.error('Settings error:', settingsError);
    }

    const businessSettings = settings as BusinessSettings || {};

    // Check for active holidays
    const { data: holidays, error: holidaysError } = await supabase
      .from('public_holidays')
      .select('*')
      .eq('is_active', true)
      .eq('date', now.toISOString().split('T')[0]);

    const isHoliday = holidays && holidays.length > 0;
    if (isHoliday) {
      issues.push(`Today is a holiday: ${holidays[0].name}`);
    }

    // Production delivery configuration
    const deliveryConfig = businessSettings.delivery_scheduling_config || {
      minimum_lead_time_minutes: 60,
      delivery_window_start: '08:00',
      delivery_window_end: '18:00',
      slot_duration_minutes: 60
    };

    const leadTimeMinutes = deliveryConfig.minimum_lead_time_minutes || 60;
    const deliveryStart = deliveryConfig.delivery_window_start || '08:00';
    const deliveryEnd = deliveryConfig.delivery_window_end || '18:00';

    // Check current business status
    let businessStatus: 'open' | 'closed' | 'holiday' = 'closed';
    let deliveryAvailable = false;

    if (isHoliday || businessSettings.holiday_mode) {
      businessStatus = 'holiday';
    } else if (businessSettings.is_open !== false) {
      // Parse current time and delivery window
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      const [startHour, startMinute] = deliveryStart.split(':').map(Number);
      const [endHour, endMinute] = deliveryEnd.split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
        businessStatus = 'open';
        
        // Check if we have enough lead time for next slot
        const nextSlotTime = new Date(now);
        nextSlotTime.setMinutes(nextSlotTime.getMinutes() + leadTimeMinutes);
        
        if (nextSlotTime.getHours() < endHour || 
           (nextSlotTime.getHours() === endHour && nextSlotTime.getMinutes() <= endMinute)) {
          deliveryAvailable = true;
        }
      }
    }

    // Calculate next available slot
    let nextAvailableSlot: string | null = null;
    if (!deliveryAvailable) {
      // If not available today, next available is tomorrow at delivery start time
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(parseInt(deliveryStart.split(':')[0]), parseInt(deliveryStart.split(':')[1]), 0, 0);
      nextAvailableSlot = tomorrow.toISOString();
    } else {
      // Next available slot is current time + lead time, rounded to next hour
      const nextSlot = new Date(now);
      nextSlot.setMinutes(nextSlot.getMinutes() + leadTimeMinutes);
      nextSlot.setMinutes(0, 0, 0); // Round to top of hour
      if (nextSlot.getHours() >= parseInt(deliveryEnd.split(':')[0])) {
        // Tomorrow's first slot
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(parseInt(deliveryStart.split(':')[0]), 0, 0, 0);
        nextAvailableSlot = tomorrow.toISOString();
      } else {
        nextAvailableSlot = nextSlot.toISOString();
      }
    }

    // Health recommendations
    if (!deliveryAvailable) {
      if (businessStatus === 'holiday') {
        recommendations.push('Consider offering limited delivery during holidays');
      } else if (businessStatus === 'closed') {
        recommendations.push('Consider extending delivery hours for better customer service');
      }
    }

    if (leadTimeMinutes < 60) {
      recommendations.push('Consider increasing lead time to 60+ minutes for better logistics');
    }

    const response: DeliveryHealthResponse = {
      healthy: issues.length === 0,
      delivery_available: deliveryAvailable,
      current_time: currentTime,
      business_status: businessStatus,
      next_available_slot: nextAvailableSlot,
      delivery_hours: {
        start: deliveryStart,
        end: deliveryEnd
      },
      lead_time_minutes: leadTimeMinutes,
      issues,
      recommendations
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Delivery health check error:', error);
    return new Response(
      JSON.stringify({
        healthy: false,
        error: 'Internal server error',
        issues: ['System error - unable to check delivery health']
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
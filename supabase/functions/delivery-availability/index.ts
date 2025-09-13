import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeliverySlotRequest {
  start_date: string;
  end_date: string;
  customer_id?: string;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
  reason?: string;
  capacity?: number;
  booked_count?: number;
}

interface DeliverySlot {
  date: string;
  is_business_day: boolean;
  is_holiday: boolean;
  holiday_name?: string;
  time_slots: TimeSlot[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚚 Delivery Availability API - Request received:', req.method);

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'GET' || req.method === 'POST') {
      let start_date: string, end_date: string, customer_id: string | undefined;

      if (req.method === 'GET') {
        const url = new URL(req.url);
        start_date = url.searchParams.get('start_date') || new Date().toISOString().split('T')[0];
        end_date = url.searchParams.get('end_date') || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        customer_id = url.searchParams.get('customer_id') || undefined;
      } else {
        const body: DeliverySlotRequest = await req.json();
        start_date = body.start_date;
        end_date = body.end_date;
        customer_id = body.customer_id;
      }
      
      console.log('📅 Fetching delivery slots from', start_date, 'to', end_date);

      // Load configuration with production-ready defaults
      const { data: configData } = await supabase
        .from('business_settings')
        .select('delivery_scheduling_config, business_hours')
        .single();

      // Production-ready default config with new hours
      const defaultConfig = {
        minimum_lead_time_minutes: 60,
        max_advance_booking_days: 60,
        default_delivery_duration_minutes: 60,
        allow_same_day_delivery: true,
        business_hours: {
          monday: { open: '08:00', close: '19:00', is_open: true },
          tuesday: { open: '08:00', close: '19:00', is_open: true },
          wednesday: { open: '08:00', close: '19:00', is_open: true },
          thursday: { open: '08:00', close: '19:00', is_open: true },
          friday: { open: '08:00', close: '19:00', is_open: true },
          saturday: { open: '08:00', close: '19:00', is_open: true },
          sunday: { open: '10:00', close: '17:00', is_open: true },
        }
      };

      // Merge with database config
      let config = defaultConfig;
      if (configData?.delivery_scheduling_config) {
        config = { ...defaultConfig, ...configData.delivery_scheduling_config };
      }
      if (configData?.business_hours) {
        config.business_hours = configData.business_hours;
      }

      // Load holidays
      const { data: holidays } = await supabase
        .from('public_holidays')
        .select('name, date')
        .eq('is_active', true)
        .gte('date', start_date)
        .lte('date', end_date);

      // Validate date range
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const maxEndDate = new Date();
      maxEndDate.setDate(maxEndDate.getDate() + config.max_advance_booking_days);

      if (endDate > maxEndDate) {
        return new Response(
          JSON.stringify({ 
            error: `Booking range exceeds ${config.max_advance_booking_days}-day limit`,
            max_date: maxEndDate.toISOString().split('T')[0]
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Generate delivery slots for the date range
      const deliverySlots: DeliverySlot[] = [];
      const currentDate = new Date(startDate);
      const maxIterations = 100;
      let iterations = 0;

      while (currentDate <= endDate && iterations < maxIterations) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = dayNames[currentDate.getDay()] as keyof typeof config.business_hours;
        
        // Check if it's a holiday
        const holiday = holidays?.find(h => h.date === dateStr);
        const isHoliday = !!holiday;
        
        // Get business hours for this day
        const businessHours = config.business_hours[dayOfWeek];
        const isBusinessDay = businessHours.is_open && !isHoliday;
        
        // Generate time slots for business days
        const timeSlots: TimeSlot[] = [];
        
        if (isBusinessDay) {
          // Production: Generate hourly slots based on day-specific hours
          const openHour = parseInt(businessHours.open.split(':')[0]);
          const openMinute = parseInt(businessHours.open.split(':')[1]);
          const closeHour = parseInt(businessHours.close.split(':')[0]);
          const closeMinute = parseInt(businessHours.close.split(':')[1]);
          
          const slotDuration = config.default_delivery_duration_minutes;
          const now = new Date();
          const minDeliveryTime = new Date(now.getTime() + config.minimum_lead_time_minutes * 60 * 1000);
          const isToday = dateStr === now.toISOString().split('T')[0];

          let currentHour = openHour;
          let currentMinute = openMinute;

          // Generate hourly slots within business hours
          while (currentHour < closeHour || (currentHour === closeHour && currentMinute < closeMinute)) {
            const slotStartTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
            
            // Calculate slot end time
            const slotEndMinutes = currentMinute + slotDuration;
            const slotEndHour = currentHour + Math.floor(slotEndMinutes / 60);
            const endMinute = slotEndMinutes % 60;
            const slotEndTime = `${String(slotEndHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

            // Don't create slot if it would end after closing time
            if (slotEndHour > closeHour || (slotEndHour === closeHour && endMinute > closeMinute)) {
              break;
            }

            // Check availability
            let available = true;
            let reason: string | undefined;

            if (isToday) {
              const slotDateTime = new Date(currentDate);
              slotDateTime.setHours(currentHour, currentMinute, 0, 0);
              
              if (slotDateTime < minDeliveryTime) {
                available = false;
                reason = `Booking window closed - minimum ${config.minimum_lead_time_minutes} minutes required`;
              } else if (slotDateTime < now) {
                available = false;
                reason = 'Time slot has passed';
              }
            }
            
            timeSlots.push({
              start_time: slotStartTime,
              end_time: slotEndTime,
              available,
              reason,
              capacity: 10, // Default capacity
              booked_count: 0 // Simplified for now
            });

            // Move to next hour
            currentHour += Math.floor(slotDuration / 60);
            currentMinute = (currentMinute + (slotDuration % 60)) % 60;
            if (currentMinute === 0 && slotDuration % 60 !== 0) {
              currentHour += 1;
            }
          }
        }

        deliverySlots.push({
          date: dateStr,
          is_business_day: isBusinessDay,
          is_holiday: isHoliday,
          holiday_name: holiday?.name,
          time_slots: timeSlots
        });

        currentDate.setDate(currentDate.getDate() + 1);
        iterations++;
      }

      const businessDaysCount = deliverySlots.filter(s => s.is_business_day).length;
      const totalSlots = deliverySlots.reduce((total, slot) => total + slot.time_slots.length, 0);
      const availableSlots = deliverySlots.reduce((total, slot) => 
        total + slot.time_slots.filter(timeSlot => timeSlot.available).length, 0
      );

      console.log('✅ Generated', deliverySlots.length, 'delivery slots,', businessDaysCount, 'business days,', totalSlots, 'total slots,', availableSlots, 'available');

      return new Response(
        JSON.stringify({ 
          success: true,
          slots: deliverySlots,
          total_days: deliverySlots.length,
          business_days: businessDaysCount,
          total_slots: totalSlots,
          available_slots: availableSlots,
          config: {
            lead_time_minutes: config.minimum_lead_time_minutes,
            max_advance_days: config.max_advance_booking_days,
            slot_duration_minutes: config.default_delivery_duration_minutes
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Delivery availability error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})
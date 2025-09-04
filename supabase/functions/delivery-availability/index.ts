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

    if (req.method === 'POST') {
      const { start_date, end_date, customer_id }: DeliverySlotRequest = await req.json();
      
      console.log('📅 Fetching delivery slots from', start_date, 'to', end_date);

      // Validate date range (max 6 months)
      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      const maxEndDate = new Date();
      maxEndDate.setMonth(maxEndDate.getMonth() + 6);

      if (endDate > maxEndDate) {
        return new Response(
          JSON.stringify({ 
            error: 'Booking range exceeds 6-month limit',
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

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        
        // Check if it's a business day (Monday=1 to Friday=5)
        const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;
        
        // Check for holidays (you can extend this with a holidays table)
        const { data: holidayData } = await supabase
          .from('delivery_holidays')
          .select('name, date')
          .eq('date', dateStr)
          .single();

        const isHoliday = !!holidayData;
        
        // Generate time slots for business days
        const timeSlots: TimeSlot[] = [];
        
        if (isBusinessDay && !isHoliday) {
          // Check existing bookings for this date
          const { data: existingBookings } = await supabase
            .from('delivery_bookings')
            .select('delivery_time_start, delivery_time_end')
            .eq('delivery_date', dateStr)
            .eq('status', 'confirmed');

          // Define available time slots (9 AM to 6 PM, 2-hour windows)
          const baseSlots = [
            { start: '09:00', end: '11:00', capacity: 10 },
            { start: '11:00', end: '13:00', capacity: 10 },
            { start: '13:00', end: '15:00', capacity: 8 }, // Reduced capacity during lunch
            { start: '15:00', end: '17:00', capacity: 10 },
            { start: '17:00', end: '19:00', capacity: 6 }, // Evening slot
          ];

          for (const slot of baseSlots) {
            // Count existing bookings for this time slot
            const bookedCount = existingBookings?.filter(booking => 
              booking.delivery_time_start === slot.start && 
              booking.delivery_time_end === slot.end
            ).length || 0;

            const available = bookedCount < slot.capacity;
            
            timeSlots.push({
              start_time: slot.start,
              end_time: slot.end,
              available,
              capacity: slot.capacity,
              booked_count: bookedCount,
              reason: available ? undefined : 'Fully booked'
            });
          }
        }

        deliverySlots.push({
          date: dateStr,
          is_business_day: isBusinessDay,
          is_holiday: isHoliday,
          holiday_name: holidayData?.name,
          time_slots: timeSlots
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('✅ Generated', deliverySlots.length, 'delivery slots');

      return new Response(
        JSON.stringify({ 
          success: true,
          slots: deliverySlots,
          total_days: deliverySlots.length,
          business_days: deliverySlots.filter(s => s.is_business_day && !s.is_holiday).length
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
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeliveryBookingRequest {
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📦 Delivery Booking API - Request received:', req.method);

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const bookingData: DeliveryBookingRequest = await req.json();
      
      console.log('📅 Creating delivery booking for:', bookingData.delivery_date, bookingData.delivery_time_start);

      // Validate booking date (not in the past, within 6 months)
      const bookingDate = new Date(bookingData.delivery_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxBookingDate = new Date();
      maxBookingDate.setMonth(maxBookingDate.getMonth() + 6);

      if (bookingDate < today) {
        return new Response(
          JSON.stringify({ 
            error: 'Cannot book delivery for past dates',
            booking_date: bookingData.delivery_date,
            today: today.toISOString().split('T')[0]
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (bookingDate > maxBookingDate) {
        return new Response(
          JSON.stringify({ 
            error: 'Booking date exceeds 6-month advance limit',
            max_date: maxBookingDate.toISOString().split('T')[0]
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if the time slot is still available
      const { data: existingBookings, error: bookingCheckError } = await supabase
        .from('delivery_bookings')
        .select('id')
        .eq('delivery_date', bookingData.delivery_date)
        .eq('delivery_time_start', bookingData.delivery_time_start)
        .eq('delivery_time_end', bookingData.delivery_time_end)
        .eq('status', 'confirmed');

      if (bookingCheckError) {
        console.error('❌ Error checking existing bookings:', bookingCheckError);
        throw bookingCheckError;
      }

      // Define slot capacity (this should match the availability function)
      const getSlotCapacity = (timeStart: string) => {
        if (timeStart === '13:00') return 8; // Lunch time reduced capacity
        if (timeStart === '17:00') return 6; // Evening reduced capacity
        return 10; // Standard capacity
      };

      const slotCapacity = getSlotCapacity(bookingData.delivery_time_start);
      const currentBookings = existingBookings?.length || 0;

      if (currentBookings >= slotCapacity) {
        return new Response(
          JSON.stringify({ 
            error: 'Time slot is fully booked',
            requested_slot: `${bookingData.delivery_time_start} - ${bookingData.delivery_time_end}`,
            current_bookings: currentBookings,
            capacity: slotCapacity
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Check if customer already has a booking for the same date (prevent double booking)
      const { data: customerBooking } = await supabase
        .from('delivery_bookings')
        .select('id')
        .eq('customer_id', bookingData.customer_id)
        .eq('delivery_date', bookingData.delivery_date)
        .eq('status', 'confirmed')
        .single();

      if (customerBooking) {
        return new Response(
          JSON.stringify({ 
            error: 'Customer already has a booking for this date',
            existing_booking_id: customerBooking.id
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Create the delivery booking
      const { data: newBooking, error: insertError } = await supabase
        .from('delivery_bookings')
        .insert({
          customer_id: bookingData.customer_id,
          delivery_date: bookingData.delivery_date,
          delivery_time_start: bookingData.delivery_time_start,
          delivery_time_end: bookingData.delivery_time_end,
          delivery_address: bookingData.address,
          order_id: bookingData.order_id,
          special_instructions: bookingData.special_instructions,
          contact_phone: bookingData.contact_phone,
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating booking:', insertError);
        throw insertError;
      }

      console.log('✅ Delivery booking created:', newBooking.id);

      // Log the booking for analytics
      await supabase
        .from('delivery_booking_analytics')
        .insert({
          booking_id: newBooking.id,
          booking_date: bookingData.delivery_date,
          booking_time_slot: `${bookingData.delivery_time_start}-${bookingData.delivery_time_end}`,
          advance_booking_days: Math.ceil((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
          customer_id: bookingData.customer_id,
          created_at: new Date().toISOString()
        });

      return new Response(
        JSON.stringify({ 
          success: true,
          booking: newBooking,
          message: 'Delivery booking confirmed successfully',
          confirmation_number: `DEL-${newBooking.id.slice(0, 8).toUpperCase()}`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'GET') {
      // Get booking details
      const url = new URL(req.url);
      const bookingId = url.searchParams.get('booking_id');
      const customerId = url.searchParams.get('customer_id');

      if (!bookingId && !customerId) {
        return new Response(
          JSON.stringify({ error: 'booking_id or customer_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let query = supabase.from('delivery_bookings').select('*');
      
      if (bookingId) {
        query = query.eq('id', bookingId);
      } else if (customerId) {
        query = query.eq('customer_id', customerId).order('delivery_date', { ascending: true });
      }

      const { data: bookings, error } = await query;

      if (error) {
        console.error('❌ Error fetching bookings:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          bookings: bookings || []
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
    console.error('❌ Delivery booking error:', error);
    
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
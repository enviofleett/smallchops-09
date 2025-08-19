import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Backfill missing schedules function called');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get user context and verify admin access
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header required'
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid authentication'
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin access required'
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ Admin access verified, proceeding with backfill...');

    // Parse request parameters
    const { days = 30 } = await req.json().catch(() => ({}));

    // Find orders without delivery schedules in the last N days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data: ordersWithoutSchedules, error: queryError } = await supabaseClient
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        order_type,
        customer_email
      `)
      .gte('created_at', cutoffDate.toISOString())
      .is('assigned_rider_id', null) // Focus on unassigned orders first
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error('❌ Failed to query orders:', queryError);
      throw new Error('Failed to query orders');
    }

    console.log(`📊 Found ${ordersWithoutSchedules?.length || 0} orders to check`);

    // Filter orders that don't have schedules
    const ordersNeedingSchedules = [];
    for (const order of ordersWithoutSchedules || []) {
      const { data: existingSchedule } = await supabaseClient
        .from('order_delivery_schedule')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (!existingSchedule) {
        ordersNeedingSchedules.push(order);
      }
    }

    console.log(`🎯 Found ${ordersNeedingSchedules.length} orders missing schedules`);

    let recovered = 0;
    let failed = 0;
    const results = [];

    // Try to recover schedules from API request logs
    for (const order of ordersNeedingSchedules) {
      try {
        console.log(`🔍 Processing order ${order.order_number}...`);

        // Look for delivery_schedule in API request logs
        const { data: requestLogs } = await supabaseClient
          .from('api_request_logs')
          .select('request_payload')
          .eq('endpoint', 'process-checkout')
          .like('request_payload', `%${order.order_number}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        let scheduleData = null;
        
        if (requestLogs && requestLogs.length > 0) {
          const payload = requestLogs[0].request_payload;
          if (payload && payload.delivery_schedule) {
            scheduleData = payload.delivery_schedule;
          }
        }

        if (scheduleData && scheduleData.delivery_date && scheduleData.delivery_time_start && scheduleData.delivery_time_end) {
          // Validate and insert the recovered schedule
          const { data: insertedSchedule, error: insertError } = await supabaseClient
            .from('order_delivery_schedule')
            .insert({
              order_id: order.id,
              delivery_date: scheduleData.delivery_date,
              delivery_time_start: scheduleData.delivery_time_start,
              delivery_time_end: scheduleData.delivery_time_end,
              is_flexible: scheduleData.is_flexible || false,
              special_instructions: scheduleData.special_instructions || null,
              requested_at: new Date().toISOString()
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`❌ Failed to insert schedule for ${order.order_number}:`, insertError);
            failed++;
            results.push({
              order_number: order.order_number,
              status: 'failed',
              error: insertError.message
            });
          } else {
            console.log(`✅ Recovered schedule for ${order.order_number}`);
            recovered++;
            results.push({
              order_number: order.order_number,
              status: 'recovered',
              schedule_id: insertedSchedule.id,
              schedule: scheduleData
            });
          }
        } else {
          console.log(`⚠️ No valid schedule data found for ${order.order_number}`);
          results.push({
            order_number: order.order_number,
            status: 'no_data',
            note: 'No valid delivery schedule found in logs'
          });
        }
      } catch (error) {
        console.error(`❌ Error processing order ${order.order_number}:`, error);
        failed++;
        results.push({
          order_number: order.order_number,
          status: 'error',
          error: error.message
        });
      }
    }

    // Log the backfill operation
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'delivery_schedules_backfilled',
        category: 'Data Migration',
        message: `Backfill operation completed: ${recovered} recovered, ${failed} failed, ${ordersNeedingSchedules.length} total processed`,
        user_id: user.id,
        old_values: null,
        new_values: {
          days_searched: days,
          orders_processed: ordersNeedingSchedules.length,
          schedules_recovered: recovered,
          failures: failed,
          results: results
        }
      });

    const response = {
      success: true,
      summary: {
        days_searched: days,
        orders_checked: ordersWithoutSchedules?.length || 0,
        orders_missing_schedules: ordersNeedingSchedules.length,
        schedules_recovered: recovered,
        failures: failed
      },
      results: results,
      message: `Backfill completed: ${recovered} schedules recovered, ${failed} failures`
    };

    console.log('✅ Backfill operation completed:', response.summary);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Backfill operation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message || 'Backfill operation failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
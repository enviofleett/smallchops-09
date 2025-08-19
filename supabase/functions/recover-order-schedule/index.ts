import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { order_id } = await req.json()
    
    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Attempting to recover schedule for order: ${order_id}`)

    // Check if schedule already exists
    const { data: existingSchedule } = await supabase
      .from('order_delivery_schedule')
      .select('id')
      .eq('order_id', order_id)
      .single()

    if (existingSchedule) {
      console.log(`✅ Schedule already exists for order: ${order_id}`)
      return new Response(
        JSON.stringify({ success: true, message: 'Schedule already exists', found: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.log(`❌ Order not found: ${order_id}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Search for delivery schedule data in API request logs
    const { data: logEntries, error: logError } = await supabase
      .from('api_request_logs')
      .select('request_payload')
      .eq('endpoint', 'process-checkout')
      .ilike('request_payload', `%${order.order_number}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (logError) {
      console.error(`❌ Error searching logs: ${logError.message}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to search logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${logEntries?.length || 0} log entries for order: ${order.order_number}`)

    // Try to extract delivery schedule from logs
    let scheduleData = null
    for (const logEntry of logEntries || []) {
      try {
        const payload = logEntry.request_payload
        if (payload && typeof payload === 'object' && payload.delivery_schedule) {
          scheduleData = payload.delivery_schedule
          console.log(`🎯 Found delivery schedule in logs:`, scheduleData)
          break
        }
      } catch (e) {
        console.warn(`⚠️ Failed to parse log entry:`, e)
        continue
      }
    }

    if (!scheduleData) {
      console.log(`❌ No delivery schedule data found in logs for order: ${order.order_number}`)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No delivery schedule data found in logs',
          found: false 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert the recovered schedule
    const { error: insertError } = await supabase
      .from('order_delivery_schedule')
      .insert({
        order_id: order_id,
        delivery_date: scheduleData.delivery_date,
        delivery_time_start: scheduleData.delivery_time_start,
        delivery_time_end: scheduleData.delivery_time_end,
        is_flexible: scheduleData.is_flexible || false,
        special_instructions: scheduleData.special_instructions || null
      })

    if (insertError) {
      console.error(`❌ Failed to insert recovered schedule:`, insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to insert schedule' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Successfully recovered and inserted schedule for order: ${order_id}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Schedule recovered successfully',
        recovered: true,
        data: scheduleData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
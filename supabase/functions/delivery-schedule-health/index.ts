import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Starting delivery schedule health check...');

    // Check for delivery orders from last 24-72 hours missing schedules
    const windowHours = 72;
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    const { data: ordersWithoutSchedules, error: queryError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_email,
        created_at,
        order_type
      `)
      .eq('order_type', 'delivery')
      .gte('created_at', cutoffTime)
      .is('order_delivery_schedule.order_id', null);

    if (queryError) {
      console.error('❌ Query error:', queryError);
      throw queryError;
    }

    const missingCount = ordersWithoutSchedules?.length || 0;
    console.log(`📊 Found ${missingCount} delivery orders missing schedules in last ${windowHours}h`);

    // Write metric to api_metrics
    if (missingCount >= 0) {
      const { error: metricError } = await supabase
        .from('api_metrics')
        .insert({
          endpoint: 'delivery-schedule-health',
          metric_type: 'delivery_schedule_missing',
          metric_value: missingCount,
          dimensions: {
            window_hours: windowHours,
            check_time: new Date().toISOString()
          }
        });

      if (metricError) {
        console.error('❌ Failed to write metric:', metricError);
      } else {
        console.log('✅ Metric written to api_metrics');
      }
    }

    // Log each missing schedule order to audit_logs
    for (const order of ordersWithoutSchedules || []) {
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action: 'delivery_schedule_missing',
          category: 'Data Quality',
          message: `Delivery order missing schedule: ${order.order_number}`,
          entity_id: order.id,
          new_values: {
            order_number: order.order_number,
            customer_email: order.customer_email,
            created_at: order.created_at,
            health_check_time: new Date().toISOString()
          }
        });

      if (auditError) {
        console.error(`❌ Failed to log audit for order ${order.order_number}:`, auditError);
      }
    }

    console.log(`✅ Health check completed. Missing schedules: ${missingCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        window_hours: windowHours,
        missing_schedules_count: missingCount,
        orders_checked: ordersWithoutSchedules?.length || 0,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
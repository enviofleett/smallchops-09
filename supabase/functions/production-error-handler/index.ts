import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface ErrorReport {
  function_name: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  request_details?: any;
  timestamp: string;
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const errorReport: ErrorReport = await req.json();
    
    console.log(`🚨 Production Error Report:`, {
      function: errorReport.function_name,
      type: errorReport.error_type,
      message: errorReport.error_message,
      timestamp: errorReport.timestamp
    });

    // Log detailed error for production monitoring
    console.error(`PRODUCTION_ERROR: ${errorReport.function_name}`, {
      error_type: errorReport.error_type,
      error_message: errorReport.error_message,
      stack_trace: errorReport.stack_trace,
      user_id: errorReport.user_id,
      timestamp: errorReport.timestamp,
      request_details: errorReport.request_details
    });

    // For critical errors, implement immediate alerting
    const criticalErrors = [
      'AUTH_SYSTEM_DOWN',
      'DATABASE_CONNECTION_FAILED', 
      'PAYMENT_PROCESSING_FAILED',
      'ORDER_CREATION_FAILED'
    ];

    if (criticalErrors.includes(errorReport.error_type)) {
      console.error(`🚨 CRITICAL PRODUCTION ERROR: ${errorReport.error_type} in ${errorReport.function_name}`);
      
      // In a real production environment, you would:
      // - Send alerts to monitoring systems (PagerDuty, Slack, etc.)
      // - Create incident tickets
      // - Trigger automated recovery procedures
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Error report logged successfully',
      error_id: crypto.randomUUID()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to process error report:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process error report'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
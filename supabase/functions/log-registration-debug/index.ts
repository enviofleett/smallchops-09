import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogRequest {
  message: string;
  level?: string;
  category?: string;
  details?: any;
  user_id?: string;
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      message,
      level = 'info',
      category = 'registration',
      details = {},
      user_id,
      session_id,
      ip_address,
      user_agent
    }: LogRequest = await req.json();

    // Get client IP if not provided
    const clientIP = ip_address || req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip');

    // Get user agent if not provided
    const clientUserAgent = user_agent || req.headers.get('user-agent');

    // Log to debug_logs table
    const { data, error } = await supabase
      .from('debug_logs')
      .insert({
        message,
        level,
        category,
        details,
        user_id,
        session_id,
        ip_address: clientIP,
        user_agent: clientUserAgent
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert debug log:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to log debug message',
          details: error 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log(`[${level.toUpperCase()}] ${category}: ${message}`, details);

    return new Response(
      JSON.stringify({ 
        success: true, 
        log_id: data.id,
        message: 'Debug message logged successfully'
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error) {
    console.error('Error in log-registration-debug function:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});
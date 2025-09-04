import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface RateLimitRequest {
  identifier: string;
  emailType: 'marketing' | 'transactional' | 'welcome' | 'order';
  checkOnly?: boolean;
}

interface RateLimitResponse {
  success: boolean;
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

const RATE_LIMITS = {
  marketing: { count: 10, windowMinutes: 60 }, // 10 marketing emails per hour
  transactional: { count: 50, windowMinutes: 60 }, // 50 transactional per hour
  welcome: { count: 5, windowMinutes: 60 }, // 5 welcome emails per hour
  order: { count: 20, windowMinutes: 60 } // 20 order emails per hour
};

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RateLimitRequest = await req.json();
    
    if (!body.identifier || !body.emailType) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing identifier or emailType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const limit = RATE_LIMITS[body.emailType];
    if (!limit) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const windowStart = new Date(Date.now() - limit.windowMinutes * 60 * 1000);
    const rateLimitKey = `${body.identifier}-${body.emailType}`;

    // Check current rate limit usage
    const { data: recentEmails, error: countError } = await supabase
      .from('smtp_delivery_logs')
      .select('id, created_at')
      .eq('recipient_email', body.identifier)
      .eq('email_type', body.emailType)
      .gte('created_at', windowStart.toISOString())
      .eq('status', 'sent');

    if (countError) {
      console.error('Rate limit check error:', countError);
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit check failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = recentEmails?.length || 0;
    const remaining = Math.max(0, limit.count - currentCount);
    const allowed = currentCount < limit.count;
    const resetTime = Date.now() + limit.windowMinutes * 60 * 1000;

    // If not just checking, record the attempt (even if blocked for audit)
    if (!body.checkOnly) {
      const { error: logError } = await supabase
        .from('smtp_health_metrics')
        .insert({
          check_type: 'rate_limit_check',
          success: allowed,
          details: {
            identifier: body.identifier,
            emailType: body.emailType,
            currentCount,
            limit: limit.count,
            allowed
          }
        });

      if (logError) {
        console.warn('Failed to log rate limit check:', logError);
      }
    }

    const response: RateLimitResponse = {
      success: true,
      allowed,
      remaining,
      resetTime
    };

    console.log(`Rate limit check for ${body.identifier} (${body.emailType}): ${currentCount}/${limit.count}, allowed: ${allowed}`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Enhanced email rate limiter error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Rate limit check failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
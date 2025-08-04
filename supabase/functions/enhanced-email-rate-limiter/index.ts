import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateLimitRequest {
  identifier: string;
  identifier_type?: 'domain' | 'ip' | 'email';
  limit_type?: 'hourly' | 'daily' | 'burst';
  action?: 'check' | 'increment';
}

interface RateLimitConfig {
  hourly: number;
  daily: number;
  burst: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { identifier, identifier_type = 'domain', limit_type = 'hourly', action = 'check' }: RateLimitRequest = await req.json();

    if (!identifier) {
      return new Response(
        JSON.stringify({ error: 'Identifier is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Define rate limits based on reputation and type
    const rateLimits: Record<string, RateLimitConfig> = {
      'new': { hourly: 10, daily: 50, burst: 2 },
      'bronze': { hourly: 50, daily: 200, burst: 5 },
      'silver': { hourly: 100, daily: 500, burst: 10 },
      'gold': { hourly: 250, daily: 1000, burst: 15 },
      'platinum': { hourly: 500, daily: 2000, burst: 20 }
    };

    // Get current reputation tier (default to 'bronze' for existing domains)
    let reputationTier = 'bronze';
    
    // Check if we have reputation data for this identifier
    const { data: reputationData } = await supabase
      .from('smtp_reputation_scores')
      .select('status, reputation_score')
      .eq('domain', identifier.includes('@') ? identifier.split('@')[1] : identifier)
      .single();

    if (reputationData) {
      if (reputationData.reputation_score >= 90) reputationTier = 'platinum';
      else if (reputationData.reputation_score >= 75) reputationTier = 'gold';
      else if (reputationData.reputation_score >= 60) reputationTier = 'silver';
      else if (reputationData.reputation_score >= 40) reputationTier = 'bronze';
      else reputationTier = 'new';
    }

    const limits = rateLimits[reputationTier];
    const currentLimit = limits[limit_type as keyof RateLimitConfig];

    // Calculate time windows
    const now = new Date();
    let windowStart: Date;
    let windowKey: string;

    switch (limit_type) {
      case 'hourly':
        windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        windowKey = `${identifier}:${identifier_type}:hourly:${windowStart.toISOString().slice(0, 13)}`;
        break;
      case 'daily':
        windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        windowKey = `${identifier}:${identifier_type}:daily:${windowStart.toISOString().slice(0, 10)}`;
        break;
      case 'burst':
        windowStart = new Date(now.getTime() - (60 * 1000)); // Last minute
        windowKey = `${identifier}:${identifier_type}:burst:${Math.floor(now.getTime() / 60000)}`;
        break;
      default:
        windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
        windowKey = `${identifier}:${identifier_type}:hourly:${windowStart.toISOString().slice(0, 13)}`;
    }

    // Check current count in api_rate_limits table
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('api_rate_limits')
      .select('request_count')
      .eq('identifier', windowKey)
      .gte('window_start', windowStart.toISOString())
      .maybeSingle();

    if (rateLimitError && rateLimitError.code !== 'PGRST116') {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Rate limit check failed', details: rateLimitError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = rateLimitData?.request_count || 0;
    const isAllowed = currentCount < currentLimit;

    // If this is an increment action and we're within limits, increment the counter
    if (action === 'increment' && isAllowed) {
      const { error: incrementError } = await supabase
        .from('api_rate_limits')
        .upsert({
          identifier: windowKey,
          endpoint: 'email_sending',
          request_count: currentCount + 1,
          window_start: windowStart.toISOString()
        }, {
          onConflict: 'identifier,endpoint,window_start'
        });

      if (incrementError) {
        console.error('Rate limit increment error:', incrementError);
        return new Response(
          JSON.stringify({ error: 'Failed to increment rate limit', details: incrementError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log rate limit check for monitoring
    await supabase
      .from('smtp_connection_audit')
      .insert({
        provider_name: 'rate_limiter',
        connection_status: isAllowed ? 'success' : 'rate_limited',
        connection_details: {
          identifier,
          identifier_type,
          limit_type,
          current_count: currentCount + (action === 'increment' && isAllowed ? 1 : 0),
          limit_threshold: currentLimit,
          reputation_tier: reputationTier,
          window_key: windowKey
        }
      });

    const response = {
      allowed: isAllowed,
      current_count: currentCount + (action === 'increment' && isAllowed ? 1 : 0),
      limit: currentLimit,
      reputation_tier: reputationTier,
      window_type: limit_type,
      reset_time: limit_type === 'burst' 
        ? new Date(Math.ceil(now.getTime() / 60000) * 60000)
        : limit_type === 'hourly'
        ? new Date(windowStart.getTime() + 60 * 60 * 1000)
        : new Date(windowStart.getTime() + 24 * 60 * 60 * 1000),
      ...(reputationData && { reputation_status: reputationData.status })
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Enhanced rate limiter error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
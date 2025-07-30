import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Real-time security monitoring and alerting system
// This function monitors security incidents and provides alerting

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

interface SecurityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

interface SecurityMetrics {
  total_incidents: number;
  critical_incidents: number;
  high_incidents: number;
  blocked_ips: number;
  failed_authentications: number;
  webhook_anomalies: number;
  rate_limit_violations: number;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authentication check for admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: user, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'dashboard';

    switch (action) {
      case 'dashboard':
        return await handleSecurityDashboard(supabaseClient, corsHeaders);
      
      case 'alerts':
        return await handleSecurityAlerts(supabaseClient, corsHeaders, url);
      
      case 'block_ip':
        if (req.method === 'POST') {
          return await handleBlockIP(supabaseClient, corsHeaders, req);
        }
        break;
      
      case 'unblock_ip':
        if (req.method === 'POST') {
          return await handleUnblockIP(supabaseClient, corsHeaders, req);
        }
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('Security monitor error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSecurityDashboard(supabase: any, corsHeaders: any) {
  try {
    const timeframe = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    
    // Get security metrics
    const { data: incidents } = await supabase
      .from('security_incidents')
      .select('severity, type, created_at')
      .gte('created_at', timeframe.toISOString());

    const { data: blockedIPs } = await supabase
      .from('blocked_ips')
      .select('count(*)')
      .eq('is_active', true);

    const { data: paymentErrors } = await supabase
      .from('payment_error_logs')
      .select('count(*)')
      .gte('occurred_at', timeframe.toISOString());

    const metrics: SecurityMetrics = {
      total_incidents: incidents?.length || 0,
      critical_incidents: incidents?.filter(i => i.severity === 'critical').length || 0,
      high_incidents: incidents?.filter(i => i.severity === 'high').length || 0,
      blocked_ips: blockedIPs?.[0]?.count || 0,
      failed_authentications: incidents?.filter(i => i.type.includes('auth')).length || 0,
      webhook_anomalies: incidents?.filter(i => i.type.includes('webhook')).length || 0,
      rate_limit_violations: incidents?.filter(i => i.type.includes('rate_limit')).length || 0
    };

    // Get recent critical alerts
    const { data: recentAlerts } = await supabase
      .from('security_incidents')
      .select('*')
      .in('severity', ['critical', 'high'])
      .gte('created_at', timeframe.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate security score
    const securityScore = calculateSecurityScore(metrics);

    return new Response(
      JSON.stringify({
        success: true,
        dashboard: {
          metrics,
          security_score: securityScore,
          recent_alerts: recentAlerts,
          status: securityScore >= 90 ? 'secure' : securityScore >= 70 ? 'warning' : 'critical'
        },
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Security dashboard error:', error);
    throw error;
  }
}

async function handleSecurityAlerts(supabase: any, corsHeaders: any, url: URL) {
  try {
    const severity = url.searchParams.get('severity');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('security_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data: alerts, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        alerts,
        pagination: {
          limit,
          offset,
          has_more: alerts.length === limit
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Security alerts error:', error);
    throw error;
  }
}

async function handleBlockIP(supabase: any, corsHeaders: any, req: Request) {
  try {
    const { ip_address, reason, duration_hours = 24 } = await req.json();

    if (!ip_address) {
      return new Response(
        JSON.stringify({ error: 'IP address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const unblockTime = new Date(Date.now() + duration_hours * 60 * 60 * 1000);

    await supabase.from('blocked_ips').insert({
      ip_address,
      reason: reason || 'Manual block by admin',
      unblock_time: unblockTime.toISOString(),
      is_active: true,
      created_at: new Date().toISOString()
    });

    // Log security incident
    await supabase.from('security_incidents').insert({
      type: 'ip_blocked_manually',
      description: `IP ${ip_address} manually blocked by admin`,
      severity: 'medium',
      request_data: { ip_address, reason, duration_hours },
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `IP ${ip_address} blocked for ${duration_hours} hours`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Block IP error:', error);
    throw error;
  }
}

async function handleUnblockIP(supabase: any, corsHeaders: any, req: Request) {
  try {
    const { ip_address } = await req.json();

    if (!ip_address) {
      return new Response(
        JSON.stringify({ error: 'IP address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('blocked_ips')
      .update({ is_active: false })
      .eq('ip_address', ip_address)
      .eq('is_active', true);

    // Log security incident
    await supabase.from('security_incidents').insert({
      type: 'ip_unblocked_manually',
      description: `IP ${ip_address} manually unblocked by admin`,
      severity: 'low',
      request_data: { ip_address },
      created_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `IP ${ip_address} unblocked`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unblock IP error:', error);
    throw error;
  }
}

function calculateSecurityScore(metrics: SecurityMetrics): number {
  let score = 100;

  // Deduct points based on incident severity
  score -= metrics.critical_incidents * 10;
  score -= metrics.high_incidents * 5;
  score -= Math.min(metrics.failed_authentications * 2, 20);
  score -= Math.min(metrics.webhook_anomalies * 3, 15);
  score -= Math.min(metrics.rate_limit_violations * 1, 10);

  // Bonus points for active security measures
  if (metrics.blocked_ips > 0) {
    score += 5; // Active threat blocking
  }

  return Math.max(0, Math.min(100, score));
}
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthMetrics {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  bounce_rate: number;
  delivery_rate: number;
  provider_health: Array<{
    provider_name: string;
    health_score: number;
    status: string;
    last_success: string | null;
    last_failure: string | null;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const timeframe = new URL(req.url).searchParams.get('timeframe') || '24h';
    const hours = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168; // 7 days
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    console.log(`=== Email Health Monitor - ${timeframe} ===`);

    // Get email delivery statistics
    const { data: emailStats, error: statsError } = await supabase
      .from('communication_events')
      .select('status, created_at')
      .gte('created_at', since);

    if (statsError) {
      throw new Error(`Failed to fetch email stats: ${statsError.message}`);
    }

    // Calculate metrics
    const totalSent = emailStats?.length || 0;
    const totalDelivered = emailStats?.filter(e => e.status === 'sent' || e.status === 'delivered').length || 0;
    const totalFailed = emailStats?.filter(e => e.status === 'failed').length || 0;
    
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
    const failureRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0;

    // Get provider health scores
    const { data: providers, error: providersError } = await supabase
      .from('smtp_provider_configs')
      .select('name, health_score, is_active, last_success_at, last_failure_at, last_error')
      .order('health_score', { ascending: false });

    if (providersError) {
      throw new Error(`Failed to fetch provider health: ${providersError.message}`);
    }

    const providerHealth = providers?.map(p => ({
      provider_name: p.name,
      health_score: p.health_score,
      status: p.is_active 
        ? (p.health_score >= 80 ? 'healthy' : p.health_score >= 50 ? 'warning' : 'critical')
        : 'inactive',
      last_success: p.last_success_at,
      last_failure: p.last_failure_at,
      last_error: p.last_error
    })) || [];

    // Check for critical issues
    const alerts = [];
    
    if (deliveryRate < 85) {
      alerts.push({
        level: 'critical',
        message: `Low delivery rate: ${deliveryRate.toFixed(1)}%`,
        recommendation: 'Check SMTP provider status and authentication'
      });
    }
    
    if (failureRate > 15) {
      alerts.push({
        level: 'warning',
        message: `High failure rate: ${failureRate.toFixed(1)}%`,
        recommendation: 'Review email templates and recipient validation'
      });
    }

    const healthyProviders = providerHealth.filter(p => p.status === 'healthy').length;
    if (healthyProviders === 0) {
      alerts.push({
        level: 'critical',
        message: 'No healthy email providers available',
        recommendation: 'Configure backup SMTP providers immediately'
      });
    } else if (healthyProviders === 1) {
      alerts.push({
        level: 'warning',
        message: 'Only one healthy email provider available',
        recommendation: 'Configure additional backup SMTP providers'
      });
    }

    // Auto-recovery for suspended accounts
    const suspendedProviders = providers?.filter(p => 
      p.last_error && p.last_error.includes('suspended')
    ) || [];

    for (const provider of suspendedProviders) {
      console.log(`🔄 Attempting recovery for suspended provider: ${provider.name}`);
      
      // Test connection with a lightweight check
      try {
        // You could implement a simple SMTP connection test here
        // For now, we'll just log the attempt
        console.log(`Recovery attempt logged for ${provider.name}`);
        
        // Log recovery attempt
        await supabase.from('smtp_connection_audit').insert({
          provider_id: provider.id,
          attempt_type: 'recovery_test',
          success: false,
          metadata: {
            reason: 'auto_recovery_attempt',
            last_error: provider.last_error
          }
        });

      } catch (recoveryError) {
        console.error(`Recovery failed for ${provider.name}:`, recoveryError);
      }
    }

    const healthMetrics: HealthMetrics = {
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_failed: totalFailed,
      bounce_rate: failureRate,
      delivery_rate: deliveryRate,
      provider_health: providerHealth
    };

    // Store health snapshot for trending
    await supabase.from('email_health_snapshots').insert({
      timeframe_hours: hours,
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_failed: totalFailed,
      delivery_rate: deliveryRate,
      failure_rate: failureRate,
      healthy_providers: healthyProviders,
      alerts: alerts,
      provider_details: providerHealth
    });

    console.log('📊 Health metrics calculated and stored');
    console.log(`Delivery rate: ${deliveryRate.toFixed(1)}%`);
    console.log(`Healthy providers: ${healthyProviders}`);
    console.log(`Alerts: ${alerts.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        timeframe,
        metrics: healthMetrics,
        alerts,
        healthy_providers_count: healthyProviders,
        recommendations: alerts.map(a => a.recommendation),
        last_updated: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('=== Email Health Monitor Error ===', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface HealthCheckResult {
  provider: string;
  healthy: boolean;
  connectionTime?: number;
  error?: string;
  timestamp: string;
}

async function testSMTPConnection(config: any): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔍 Testing SMTP connection to ${config.host}:${config.port}`);
    
    const connectPromise = config.port === 465 
      ? Deno.connectTls({ hostname: config.host, port: config.port })
      : Deno.connect({ hostname: config.host, port: config.port });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout (10s)')), 10000);
    });
    
    const connection = await Promise.race([connectPromise, timeoutPromise]) as Deno.TcpConn;
    const connectionTime = Date.now() - startTime;
    
    // Close connection immediately after successful connect
    try {
      connection.close();
    } catch (e) {
      console.warn('Error closing test connection:', e);
    }
    
    console.log(`✅ SMTP connection successful to ${config.host} in ${connectionTime}ms`);
    
    return {
      provider: config.name || config.host,
      healthy: true,
      connectionTime,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    const connectionTime = Date.now() - startTime;
    console.error(`❌ SMTP connection failed to ${config.host}:`, error.message);
    
    return {
      provider: config.name || config.host,
      healthy: false,
      connectionTime,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

async function performHealthCheck(supabase: any) {
  console.log('🏥 Starting comprehensive SMTP health check...');
  
  try {
    // Get all SMTP provider configurations
    const { data: providers, error: providersError } = await supabase
      .from('smtp_provider_configs')
      .select('*')
      .eq('is_active', true);

    if (providersError) {
      console.error('Error fetching SMTP providers:', providersError);
      return { success: false, error: 'Failed to fetch SMTP providers' };
    }

    // Get current communication settings
    const { data: commSettings } = await supabase
      .from('communication_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const healthResults: HealthCheckResult[] = [];
    
    // Test configured SMTP provider from communication_settings
    if (commSettings && commSettings.use_smtp) {
      const mainConfig = {
        name: 'Primary SMTP',
        host: commSettings.smtp_host,
        port: commSettings.smtp_port,
        username: commSettings.smtp_user,
        secure: commSettings.smtp_secure
      };
      
      const mainResult = await testSMTPConnection(mainConfig);
      healthResults.push(mainResult);
      
      // Record health metric
      await supabase.rpc('record_smtp_health_metric', {
        p_provider_name: mainConfig.name,
        p_metric_type: 'connection_time',
        p_metric_value: mainResult.connectionTime || 0,
        p_threshold_value: 5000 // 5 second threshold
      });
    }

    // Test additional configured providers
    for (const provider of providers || []) {
      if (provider.host && provider.port) {
        const result = await testSMTPConnection(provider);
        healthResults.push(result);
        
        // Update provider health score
        const healthScore = result.healthy ? 
          Math.min(100, provider.health_score + 5) : 
          Math.max(0, provider.health_score - 20);
        
        await supabase
          .from('smtp_provider_configs')
          .update({
            health_score: healthScore,
            last_health_check: new Date().toISOString(),
            consecutive_failures: result.healthy ? 0 : provider.consecutive_failures + 1,
            last_failure_at: result.healthy ? provider.last_failure_at : new Date().toISOString()
          })
          .eq('id', provider.id);
      }
    }

    // Calculate overall health metrics
    const totalProviders = healthResults.length;
    const healthyProviders = healthResults.filter(r => r.healthy).length;
    const overallHealthPercentage = totalProviders > 0 ? (healthyProviders / totalProviders) * 100 : 0;
    
    // Check for reputation issues
    const { data: reputationIssues } = await supabase
      .from('smtp_reputation_scores')
      .select('*')
      .in('status', ['warning', 'suspended']);

    // Check for recent bounce rate spikes
    const { data: recentBounces } = await supabase
      .from('email_bounce_tracking')
      .select('*')
      .gte('last_bounce_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Calculate recent bounce rate
    const { data: recentEmails } = await supabase
      .from('communication_events')
      .select('count')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .eq('status', 'sent');

    const recentEmailCount = recentEmails?.[0]?.count || 0;
    const recentBounceCount = recentBounces?.length || 0;
    const currentBounceRate = recentEmailCount > 0 ? (recentBounceCount / recentEmailCount) * 100 : 0;

    // Determine if automatic actions are needed
    const criticalIssues = [];
    const warnings = [];

    if (overallHealthPercentage < 50) {
      criticalIssues.push('More than 50% of SMTP providers are unhealthy');
    }

    if (currentBounceRate > 5) {
      criticalIssues.push(`Bounce rate is ${currentBounceRate.toFixed(2)}% (threshold: 5%)`);
    } else if (currentBounceRate > 2) {
      warnings.push(`Bounce rate is ${currentBounceRate.toFixed(2)}% (warning threshold: 2%)`);
    }

    if (reputationIssues && reputationIssues.length > 0) {
      const suspendedDomains = reputationIssues.filter(r => r.status === 'suspended').length;
      const warningDomains = reputationIssues.filter(r => r.status === 'warning').length;
      
      if (suspendedDomains > 0) {
        criticalIssues.push(`${suspendedDomains} domain(s) suspended due to poor reputation`);
      }
      if (warningDomains > 0) {
        warnings.push(`${warningDomains} domain(s) have reputation warnings`);
      }
    }

    // Record overall health metrics
    await supabase.from('smtp_health_metrics').insert([
      {
        provider_name: 'system',
        metric_type: 'overall_health',
        metric_value: overallHealthPercentage,
        threshold_value: 80,
        threshold_breached: overallHealthPercentage < 80
      },
      {
        provider_name: 'system',
        metric_type: 'bounce_rate',
        metric_value: currentBounceRate,
        threshold_value: 5,
        threshold_breached: currentBounceRate > 5
      }
    ]);

    console.log(`🏥 Health check completed. Overall health: ${overallHealthPercentage.toFixed(1)}%`);
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      overallHealth: overallHealthPercentage,
      providerResults: healthResults,
      metrics: {
        totalProviders,
        healthyProviders,
        recentBounceRate: currentBounceRate,
        recentEmailsSent: recentEmailCount
      },
      issues: {
        critical: criticalIssues,
        warnings: warnings,
        reputationIssues: reputationIssues || []
      },
      recommendations: generateRecommendations(criticalIssues, warnings, currentBounceRate)
    };

  } catch (error) {
    console.error('Health check error:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

function generateRecommendations(critical: string[], warnings: string[], bounceRate: number): string[] {
  const recommendations = [];

  if (critical.length > 0) {
    recommendations.push('URGENT: Address critical SMTP issues immediately to prevent service disruption');
  }

  if (bounceRate > 5) {
    recommendations.push('Implement immediate bounce rate reduction measures (list cleaning, suppression)');
    recommendations.push('Consider temporarily reducing email volume to improve reputation');
  } else if (bounceRate > 2) {
    recommendations.push('Monitor bounce rate closely and consider list validation');
  }

  if (warnings.length > 0) {
    recommendations.push('Review and address warning-level issues to prevent escalation');
  }

  // General recommendations
  recommendations.push('Maintain regular list hygiene and validation');
  recommendations.push('Monitor delivery metrics and adjust sending patterns as needed');
  recommendations.push('Ensure proper email authentication (SPF, DKIM, DMARC)');

  return recommendations;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === 'POST') {
      // Manual health check trigger
      const result = await performHealthCheck(supabase);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: result.success ? 200 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method === 'GET') {
      // Get latest health metrics
      const { data: latestMetrics } = await supabase
        .from('smtp_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(20);

      const { data: providerHealth } = await supabase
        .from('smtp_provider_configs')
        .select('name, health_score, is_active, last_health_check, consecutive_failures')
        .eq('is_active', true);

      return new Response(
        JSON.stringify({
          success: true,
          latestMetrics,
          providerHealth,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('SMTP health monitor error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
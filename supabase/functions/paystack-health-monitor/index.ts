import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts';

const VERSION = "v2025-08-22-health-monitor";

// Enhanced logging function
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [health-monitor ${VERSION}] ${level.toUpperCase()}: ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('info', '🏥 Paystack health check started');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const healthReport = {
      timestamp: new Date().toISOString(),
      version: VERSION,
      paystack_config: {
        status: 'unknown',
        environment: 'unknown',
        errors: [] as string[]
      },
      database: {
        status: 'unknown',
        errors: [] as string[]
      },
      api_connectivity: {
        status: 'unknown',
        response_time_ms: 0,
        errors: [] as string[]
      },
      recent_transactions: {
        total_24h: 0,
        successful_24h: 0,
        failed_24h: 0,
        success_rate: 0
      },
      overall_status: 'unknown' as 'healthy' | 'degraded' | 'critical' | 'unknown'
    };

    // 1. Check Paystack Configuration
    try {
      const paystackConfig = getPaystackConfig(req);
      const validation = validatePaystackConfig(paystackConfig);
      
      if (validation.isValid) {
        healthReport.paystack_config.status = 'healthy';
        healthReport.paystack_config.environment = paystackConfig.environment;
        logPaystackConfigStatus(paystackConfig);
      } else {
        healthReport.paystack_config.status = 'critical';
        healthReport.paystack_config.errors = validation.errors;
      }
    } catch (configError) {
      healthReport.paystack_config.status = 'critical';
      healthReport.paystack_config.errors.push(configError.message);
    }

    // 2. Check Database Connectivity
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id')
        .limit(1);
      
      if (error) {
        healthReport.database.status = 'critical';
        healthReport.database.errors.push(error.message);
      } else {
        healthReport.database.status = 'healthy';
      }
    } catch (dbError) {
      healthReport.database.status = 'critical';
      healthReport.database.errors.push(dbError.message);
    }

    // 3. Check Paystack API Connectivity
    if (healthReport.paystack_config.status === 'healthy') {
      try {
        const paystackConfig = getPaystackConfig(req);
        const startTime = Date.now();
        
        const response = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackConfig.secretKey}`,
            'Content-Type': 'application/json',
            'User-Agent': `PaystackHealthMonitor/${VERSION}`
          },
          signal: AbortSignal.timeout(10000)
        });

        const responseTime = Date.now() - startTime;
        healthReport.api_connectivity.response_time_ms = responseTime;

        if (response.ok) {
          healthReport.api_connectivity.status = 'healthy';
        } else {
          healthReport.api_connectivity.status = 'degraded';
          healthReport.api_connectivity.errors.push(`API returned ${response.status}`);
        }
      } catch (apiError) {
        healthReport.api_connectivity.status = 'critical';
        healthReport.api_connectivity.errors.push(apiError.message);
      }
    }

    // 4. Check Recent Transaction Health
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentTransactions, error: transactionError } = await supabase
        .from('payment_transactions')
        .select('status')
        .gte('created_at', twentyFourHoursAgo);
      
      if (!transactionError && recentTransactions) {
        healthReport.recent_transactions.total_24h = recentTransactions.length;
        healthReport.recent_transactions.successful_24h = recentTransactions.filter(t => t.status === 'paid').length;
        healthReport.recent_transactions.failed_24h = recentTransactions.filter(
          t => ['failed', 'cancelled', 'mismatch', 'orphaned'].includes(t.status)
        ).length;
        
        if (healthReport.recent_transactions.total_24h > 0) {
          healthReport.recent_transactions.success_rate = 
            (healthReport.recent_transactions.successful_24h / healthReport.recent_transactions.total_24h) * 100;
        }
      }
    } catch (transactionError) {
      log('warn', '⚠️ Could not fetch transaction metrics', { error: transactionError.message });
    }

    // 5. Determine Overall Health Status
    const criticalIssues = [
      healthReport.paystack_config.status === 'critical',
      healthReport.database.status === 'critical',
      healthReport.api_connectivity.status === 'critical'
    ].filter(Boolean).length;

    const degradedIssues = [
      healthReport.paystack_config.status === 'degraded',
      healthReport.database.status === 'degraded',
      healthReport.api_connectivity.status === 'degraded',
      healthReport.recent_transactions.success_rate < 95 && healthReport.recent_transactions.total_24h > 10
    ].filter(Boolean).length;

    if (criticalIssues > 0) {
      healthReport.overall_status = 'critical';
    } else if (degradedIssues > 0) {
      healthReport.overall_status = 'degraded';
    } else {
      healthReport.overall_status = 'healthy';
    }

    // Log health summary
    log('info', `🏥 Health check completed - Status: ${healthReport.overall_status}`, {
      paystack_config: healthReport.paystack_config.status,
      database: healthReport.database.status,
      api_connectivity: healthReport.api_connectivity.status,
      success_rate: healthReport.recent_transactions.success_rate
    });

    // Store health check result (non-blocking)
    try {
      await supabase
        .from('system_health_checks')
        .insert({
          service: 'paystack_integration',
          status: healthReport.overall_status,
          details: healthReport,
          created_at: new Date().toISOString()
        });
    } catch (insertError) {
      log('warn', '⚠️ Could not store health check result', { error: insertError.message });
    }

    const httpStatus = healthReport.overall_status === 'critical' ? 503 : 
                      healthReport.overall_status === 'degraded' ? 200 : 200;

    return new Response(JSON.stringify({
      success: healthReport.overall_status !== 'critical',
      health_report: healthReport
    }), {
      status: httpStatus,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    log('error', '❌ Health monitor error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({
      success: false,
      health_report: {
        timestamp: new Date().toISOString(),
        overall_status: 'critical',
        error: error.message
      }
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
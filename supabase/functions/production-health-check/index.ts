import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// PRODUCTION CORS - Environment-aware
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const isDev = Deno.env.get('DENO_ENV') === 'development';
  
  if (isDev) {
    allowedOrigins.push('http://localhost:5173');
  }
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isDev ? '*' : 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({
      healthy: false,
      error: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const healthStatus = await performHealthCheck(supabase);

    return new Response(JSON.stringify(healthStatus), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: healthStatus.overall === 'healthy' ? 200 : 503,
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return new Response(JSON.stringify({
      healthy: false,
      overall: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Comprehensive health check implementation
async function performHealthCheck(supabase: any) {
  const checks = {
    database: { status: 'unknown', message: '' },
    environment: { status: 'unknown', message: '' },
    email: { status: 'unknown', message: '' },
    payments: { status: 'unknown', message: '' },
    security: { status: 'unknown', score: 0 }
  };

  let overallHealthy = true;

  // Database connectivity check
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      checks.database = { status: 'error', message: `Database error: ${error.message}` };
      overallHealthy = false;
    } else {
      // Check RLS is enabled
      const { data: rlsCheck } = await supabase.rpc('health_check');
      checks.database = { 
        status: 'healthy', 
        message: rlsCheck ? 'Database connected with RLS enabled' : 'Database connected'
      };
    }
  } catch (error) {
    checks.database = { status: 'error', message: 'Database connection failed' };
    overallHealthy = false;
  }

  // Environment variables check
  const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALLOWED_ORIGINS'];
  const missingVars = requiredEnvVars.filter(varName => !Deno.env.get(varName));
  
  if (missingVars.length > 0) {
    checks.environment = { 
      status: 'warning', 
      message: `Missing environment variables: ${missingVars.join(', ')}` 
    };
  } else {
    const corsConfig = Deno.env.get('ALLOWED_ORIGINS');
    if (corsConfig === '*') {
      checks.environment = { 
        status: 'warning', 
        message: 'CORS configured with wildcard - security risk in production' 
      };
    } else {
      checks.environment = { status: 'healthy', message: 'Environment properly configured' };
    }
  }

  // Email system check
  try {
    const { data: emailConfig } = await supabase
      .from('communication_settings')
      .select('sender_email, mailersend_domain_verified')
      .single();
    
    const mailersendToken = Deno.env.get('MAILERSEND_API_TOKEN');
    
    if (!mailersendToken) {
      checks.email = { status: 'error', message: 'MailerSend API token not configured' };
      overallHealthy = false;
    } else if (!emailConfig?.sender_email) {
      checks.email = { status: 'warning', message: 'Sender email not configured' };
    } else if (!emailConfig?.mailersend_domain_verified) {
      checks.email = { status: 'warning', message: 'Email domain not verified' };
    } else {
      checks.email = { status: 'healthy', message: 'Email system configured and verified' };
    }
  } catch (error) {
    checks.email = { status: 'error', message: 'Failed to check email configuration' };
  }

  // Payment system check
  try {
    const { data: paymentConfig } = await supabase
      .from('payment_integrations')
      .select('provider, connection_status')
      .eq('provider', 'paystack')
      .single();
    
    if (!paymentConfig) {
      checks.payments = { status: 'warning', message: 'No payment integration configured' };
    } else if (paymentConfig.connection_status !== 'connected') {
      checks.payments = { status: 'error', message: 'Payment integration not connected' };
      overallHealthy = false;
    } else {
      checks.payments = { status: 'healthy', message: 'Payment system connected' };
    }
  } catch (error) {
    checks.payments = { status: 'error', message: 'Failed to check payment configuration' };
  }

  // Security score calculation
  const securityScore = await calculateSecurityScore(supabase);
  checks.security = { status: securityScore >= 80 ? 'healthy' : 'warning', score: securityScore };

  // Generate recommendations
  const recommendations = generateRecommendations(checks);

  return {
    healthy: overallHealthy,
    overall: overallHealthy ? 'healthy' : 'degraded',
    checks,
    recommendations,
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  };
}

// Security score calculation
async function calculateSecurityScore(supabase: any): Promise<number> {
  let score = 100;

  // Check for test data in production
  try {
    const { data: testOrders } = await supabase
      .from('orders')
      .select('count')
      .ilike('customer_email', '%test%')
      .limit(1);
    
    if (testOrders && testOrders.length > 0) {
      score -= 20; // Deduct for test data
    }
  } catch (error) {
    // Non-critical error
  }

  // Check CORS configuration
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  if (!allowedOrigins || allowedOrigins === '*') {
    score -= 30; // Major security issue
  }

  // Check for placeholder data
  try {
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('email, phone')
      .single();
    
    if (businessSettings?.email?.includes('example.com') || 
        businessSettings?.phone?.includes('555-')) {
      score -= 10; // Minor deduction for placeholder data
    }
  } catch (error) {
    // Non-critical error
  }

  return Math.max(score, 0);
}

// Generate actionable recommendations
function generateRecommendations(checks: any): string[] {
  const recommendations: string[] = [];

  if (checks.environment.status !== 'healthy') {
    recommendations.push('Configure all required environment variables in Supabase Edge Functions settings');
  }

  if (checks.email.status === 'error') {
    recommendations.push('Configure MailerSend API token in Supabase secrets');
  } else if (checks.email.status === 'warning') {
    recommendations.push('Verify your email domain in MailerSend dashboard');
  }

  if (checks.payments.status !== 'healthy') {
    recommendations.push('Configure and connect Paystack payment integration');
  }

  if (checks.security.score < 80) {
    recommendations.push('Review and improve security configuration');
    if (!Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('ALLOWED_ORIGINS') === '*') {
      recommendations.push('Set specific allowed origins for CORS instead of wildcard');
    }
  }

  if (checks.database.status !== 'healthy') {
    recommendations.push('Check database connectivity and RLS policies');
  }

  return recommendations;
}
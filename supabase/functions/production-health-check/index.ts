import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 Starting production health check...');
    
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const healthChecks: HealthCheck[] = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // 1. Database Connection Check
    try {
      const { data, error } = await supabaseClient.from('products').select('id').limit(1);
      if (error) throw error;
      healthChecks.push({
        component: 'Database',
        status: 'healthy',
        message: 'Database connection successful'
      });
    } catch (error) {
      healthChecks.push({
        component: 'Database',
        status: 'critical',
        message: 'Database connection failed',
        details: error.message
      });
      overallStatus = 'critical';
    }

    // 2. Payment System Check
    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) {
      healthChecks.push({
        component: 'Payment System',
        status: 'critical',
        message: 'PAYSTACK_SECRET_KEY not configured'
      });
      overallStatus = 'critical';
    } else if (paystackKey.startsWith('sk_test_')) {
      healthChecks.push({
        component: 'Payment System',
        status: 'warning',
        message: 'Using test Paystack key - switch to live key for production'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    } else if (paystackKey.startsWith('sk_live_')) {
      healthChecks.push({
        component: 'Payment System',
        status: 'healthy',
        message: 'Live Paystack key configured'
      });
    } else {
      healthChecks.push({
        component: 'Payment System',
        status: 'warning',
        message: 'Paystack key format unrecognized'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    // 3. Email System Check
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      healthChecks.push({
        component: 'Email System',
        status: 'warning',
        message: 'RESEND_API_KEY not configured - email notifications disabled'
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    } else {
      healthChecks.push({
        component: 'Email System',
        status: 'healthy',
        message: 'Resend API key configured'
      });
    }

    // 4. Product Catalog Check
    try {
      const { data: products } = await supabaseClient
        .from('products')
        .select('id')
        .eq('is_active', true);
      
      if (!products || products.length === 0) {
        healthChecks.push({
          component: 'Product Catalog',
          status: 'critical',
          message: 'No active products found'
        });
        overallStatus = 'critical';
      } else if (products.length < 5) {
        healthChecks.push({
          component: 'Product Catalog',
          status: 'warning',
          message: `Only ${products.length} active products (recommend at least 5)`
        });
        if (overallStatus !== 'critical') overallStatus = 'warning';
      } else {
        healthChecks.push({
          component: 'Product Catalog',
          status: 'healthy',
          message: `${products.length} active products available`
        });
      }
    } catch (error) {
      healthChecks.push({
        component: 'Product Catalog',
        status: 'critical',
        message: 'Failed to check products',
        details: error.message
      });
      overallStatus = 'critical';
    }

    // 5. Delivery System Check
    try {
      const { data: zones } = await supabaseClient
        .from('delivery_zones')
        .select('id')
        .eq('is_active', true);
      
      const { data: pickupPoints } = await supabaseClient
        .from('pickup_points')
        .select('id')
        .eq('is_active', true);

      if ((!zones || zones.length === 0) && (!pickupPoints || pickupPoints.length === 0)) {
        healthChecks.push({
          component: 'Delivery System',
          status: 'critical',
          message: 'No active delivery zones or pickup points configured'
        });
        overallStatus = 'critical';
      } else {
        healthChecks.push({
          component: 'Delivery System',
          status: 'healthy',
          message: `${zones?.length || 0} delivery zones, ${pickupPoints?.length || 0} pickup points`
        });
      }
    } catch (error) {
      healthChecks.push({
        component: 'Delivery System',
        status: 'warning',
        message: 'Failed to check delivery configuration',
        details: error.message
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    // 6. Admin User Check
    try {
      const { data: admins } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);
      
      if (!admins || admins.length === 0) {
        healthChecks.push({
          component: 'Admin Access',
          status: 'critical',
          message: 'No active admin users found'
        });
        overallStatus = 'critical';
      } else {
        healthChecks.push({
          component: 'Admin Access',
          status: 'healthy',
          message: `${admins.length} active admin user(s)`
        });
      }
    } catch (error) {
      healthChecks.push({
        component: 'Admin Access',
        status: 'warning',
        message: 'Failed to check admin users',
        details: error.message
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    // 7. Security Check (RLS)
    try {
      const { data: rlsPolicies } = await supabaseClient
        .from('pg_policies')
        .select('tablename')
        .ilike('tablename', 'orders');
      
      if (!rlsPolicies || rlsPolicies.length === 0) {
        healthChecks.push({
          component: 'Security (RLS)',
          status: 'critical',
          message: 'No RLS policies found on orders table'
        });
        overallStatus = 'critical';
      } else {
        healthChecks.push({
          component: 'Security (RLS)',
          status: 'healthy',
          message: 'RLS policies configured'
        });
      }
    } catch (error) {
      healthChecks.push({
        component: 'Security (RLS)',
        status: 'warning',
        message: 'Could not verify RLS configuration',
        details: error.message
      });
      if (overallStatus !== 'critical') overallStatus = 'warning';
    }

    const response = {
      overall_status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
      summary: {
        total_checks: healthChecks.length,
        healthy: healthChecks.filter(c => c.status === 'healthy').length,
        warnings: healthChecks.filter(c => c.status === 'warning').length,
        critical: healthChecks.filter(c => c.status === 'critical').length
      },
      production_ready: overallStatus !== 'critical',
      recommendations: overallStatus === 'critical' 
        ? ['Fix all critical issues before launching']
        : overallStatus === 'warning'
        ? ['Address warnings to improve system reliability']
        : ['System is ready for production launch']
    };

    console.log('✅ Health check completed:', response.overall_status);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return new Response(
      JSON.stringify({
        overall_status: 'critical',
        error: error.message,
        timestamp: new Date().toISOString(),
        production_ready: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
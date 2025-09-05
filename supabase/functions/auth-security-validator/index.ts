import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Starting secure authentication health validation...')
    
    // Use secure database functions instead of direct queries
    const [authResult, rlsResult, productionResult] = await Promise.allSettled([
      supabase.rpc('check_auth_health'),
      supabase.rpc('check_rls_status'),
      supabase.rpc('assess_production_readiness')
    ])

    // Process authentication health results
    const authHealth = authResult.status === 'fulfilled' && !authResult.value.error 
      ? authResult.value.data 
      : {
          healthy: false,
          score: 0,
          status: 'unavailable',
          issues: ['Authentication health check failed'],
          warnings: [],
          metrics: {}
        }

    // Process security compliance results  
    const securityCompliance = rlsResult.status === 'fulfilled' && !rlsResult.value.error
      ? {
          compliant: rlsResult.value.data?.compliant || false,
          score: rlsResult.value.data?.compliant ? 100 : 0,
          metrics: rlsResult.value.data || {},
          issues: rlsResult.value.data?.compliant ? [] : ['RLS policies missing on critical tables'],
          warnings: [],
          status: rlsResult.value.data?.compliant ? 'compliant' : 'non_compliant'
        }
      : {
          compliant: false,
          score: 0,
          metrics: {},
          issues: ['Security compliance check failed'],
          warnings: [],
          status: 'unavailable'
        }

    // Process production readiness results
    const productionReady = productionResult.status === 'fulfilled' && !productionResult.value.error
      ? productionResult.value.data
      : {
          ready_for_production: false,
          overall_score: 0,
          status: 'unavailable',
          issues: ['Production readiness assessment failed'],
          warnings: [],
          recommendations: [],
          component_scores: {
            authentication: 0,
            security: 0,
            configuration: 0
          }
        }

    console.log('✅ Security validation completed successfully')

    return new Response(
      JSON.stringify({
        success: true,
        auth_health: authHealth,
        security_compliance: securityCompliance,
        production_ready: productionReady,
        timestamp: new Date().toISOString(),
        validation_method: 'secure_database_functions'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Auth security validation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        auth_health: {
          healthy: false,
          score: 0,
          status: 'error',
          issues: ['System validation failed'],
          warnings: [],
          metrics: {}
        },
        security_compliance: {
          compliant: false,
          score: 0,
          status: 'error',
          issues: ['Security check failed'],
          warnings: [],
          metrics: {}
        },
        production_ready: {
          ready_for_production: false,
          overall_score: 0,
          status: 'error',
          issues: ['Production check failed'],
          warnings: [],
          recommendations: [],
          component_scores: {}
        },
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
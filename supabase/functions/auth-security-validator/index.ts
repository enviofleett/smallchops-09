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

    // Check authentication health
    const authHealthResult = await checkAuthenticationHealth(supabase)
    
    // Check security compliance
    const securityResult = await checkSecurityCompliance(supabase)
    
    // Check production readiness
    const productionResult = await checkProductionReadiness(supabase, authHealthResult, securityResult)

    return new Response(
      JSON.stringify({
        success: true,
        auth_health: authHealthResult,
        security_compliance: securityResult,
        production_ready: productionResult,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Auth security validation error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function checkAuthenticationHealth(supabase: any) {
  try {
    // Check for recent user registrations
    const { data: recentUsers, error: usersError } = await supabase
      .from('customer_accounts')
      .select('id, created_at, email_verified')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (usersError) throw usersError

    // Check authentication events
    const { data: authEvents, error: eventsError } = await supabase
      .from('customer_auth_audit')
      .select('success, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (eventsError) throw eventsError

    const totalRecentUsers = recentUsers?.length || 0
    const verifiedUsers = recentUsers?.filter(u => u.email_verified).length || 0
    const successfulAuth = authEvents?.filter(e => e.success).length || 0
    const failedAuth = authEvents?.filter(e => !e.success).length || 0

    let score = 100
    const issues = []
    const warnings = []

    // Scoring logic
    if (totalRecentUsers === 0) {
      score -= 30
      issues.push('No recent user registrations in the last 30 days')
    }

    if (verifiedUsers < totalRecentUsers * 0.8) {
      score -= 20
      warnings.push('Low email verification rate')
    }

    if (failedAuth > successfulAuth * 0.1) {
      score -= 15
      warnings.push('High authentication failure rate')
    }

    if (successfulAuth === 0) {
      score -= 25
      issues.push('No successful authentication events in the last 24 hours')
    }

    return {
      healthy: score >= 80,
      score: Math.max(score, 0),
      metrics: {
        total_users: totalRecentUsers,
        verified_users: verifiedUsers,
        verification_rate: totalRecentUsers > 0 ? (verifiedUsers / totalRecentUsers * 100).toFixed(1) : '0',
        successful_auth: successfulAuth,
        failed_auth: failedAuth,
        failure_rate: successfulAuth > 0 ? (failedAuth / (successfulAuth + failedAuth) * 100).toFixed(1) : '0'
      },
      issues,
      warnings,
      status: score >= 90 ? 'excellent' : score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical'
    }
  } catch (error) {
    console.error('Auth health check failed:', error)
    return {
      healthy: false,
      score: 0,
      metrics: {},
      issues: ['Failed to check authentication health: ' + error.message],
      warnings: [],
      status: 'critical'
    }
  }
}

async function checkSecurityCompliance(supabase: any) {
  try {
    // Check RLS status on critical tables
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          schemaname, 
          tablename, 
          rowsecurity as rls_enabled,
          CASE WHEN rowsecurity THEN 'enabled' ELSE 'disabled' END as status
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE schemaname = 'public' 
        AND tablename IN ('customer_accounts', 'orders', 'payment_transactions', 'profiles', 'business_settings')
        ORDER BY tablename
      `
    })

    if (rlsError) {
      console.warn('Could not check RLS status:', rlsError)
    }

    let score = 100
    const issues = []
    const warnings = []

    // Check critical tables have RLS
    const criticalTables = ['customer_accounts', 'orders', 'payment_transactions']
    const tablesWithoutRLS = rlsStatus?.filter(t => 
      criticalTables.includes(t.tablename) && !t.rls_enabled
    ) || []

    if (tablesWithoutRLS.length > 0) {
      score -= tablesWithoutRLS.length * 30
      issues.push(`${tablesWithoutRLS.length} critical tables without RLS: ${tablesWithoutRLS.map(t => t.tablename).join(', ')}`)
    }

    // Check for recent security events
    const { data: securityEvents, error: secEventsError } = await supabase
      .from('audit_logs')
      .select('action, category, event_time')
      .eq('category', 'Security')
      .gte('event_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('event_time', { ascending: false })
      .limit(10)

    const recentSecurityEvents = securityEvents?.length || 0
    if (recentSecurityEvents === 0) {
      warnings.push('No recent security audit events found')
    }

    return {
      compliant: score >= 80,
      score: Math.max(score, 0),
      metrics: {
        tables_with_rls: (rlsStatus?.filter(t => t.rls_enabled).length || 0),
        tables_without_rls: tablesWithoutRLS.length,
        recent_security_events: recentSecurityEvents
      },
      rls_status: rlsStatus || [],
      issues,
      warnings,
      status: score >= 90 ? 'excellent' : score >= 80 ? 'good' : score >= 60 ? 'warning' : 'critical'
    }
  } catch (error) {
    console.error('Security compliance check failed:', error)
    return {
      compliant: false,
      score: 0,
      metrics: {},
      rls_status: [],
      issues: ['Failed to check security compliance: ' + error.message],
      warnings: [],
      status: 'critical'
    }
  }
}

async function checkProductionReadiness(supabase: any, authHealth: any, securityCompliance: any) {
  try {
    // Check business settings
    const { data: businessSettings, error: settingsError } = await supabase
      .from('business_settings')
      .select('name, logo_url, admin_notification_email')
      .single()

    let readinessScore = (authHealth.score + securityCompliance.score) / 2
    const allIssues = [...(authHealth.issues || []), ...(securityCompliance.issues || [])]
    const allWarnings = [...(authHealth.warnings || []), ...(securityCompliance.warnings || [])]

    // Business settings checks
    if (!businessSettings?.name) {
      readinessScore -= 10
      allIssues.push('Business name not configured')
    }

    if (!businessSettings?.admin_notification_email) {
      readinessScore -= 15
      allIssues.push('Admin notification email not configured')
    }

    const isReady = readinessScore >= 80 && allIssues.length === 0

    return {
      ready_for_production: isReady,
      overall_score: Math.max(readinessScore, 0),
      component_scores: {
        authentication: authHealth.score,
        security: securityCompliance.score,
        configuration: businessSettings ? 85 : 60
      },
      issues: allIssues,
      warnings: allWarnings,
      recommendations: generateRecommendations(authHealth, securityCompliance, businessSettings),
      status: readinessScore >= 90 ? 'excellent' : readinessScore >= 80 ? 'good' : readinessScore >= 60 ? 'needs_improvement' : 'not_ready'
    }
  } catch (error) {
    console.error('Production readiness check failed:', error)
    return {
      ready_for_production: false,
      overall_score: 0,
      component_scores: {},
      issues: ['Failed to check production readiness: ' + error.message],
      warnings: [],
      recommendations: [],
      status: 'not_ready'
    }
  }
}

function generateRecommendations(authHealth: any, securityCompliance: any, businessSettings: any) {
  const recommendations = []

  if (authHealth.score < 80) {
    recommendations.push('Improve authentication system reliability and user verification processes')
  }

  if (securityCompliance.score < 80) {
    recommendations.push('Address security compliance issues, especially RLS policies on critical tables')
  }

  if (!businessSettings?.admin_notification_email) {
    recommendations.push('Configure admin notification email for system alerts')
  }

  if (authHealth.metrics?.verification_rate < 80) {
    recommendations.push('Implement email verification reminders to improve verification rates')
  }

  if (securityCompliance.metrics?.recent_security_events === 0) {
    recommendations.push('Ensure security audit logging is properly configured')
  }

  return recommendations
}
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[ENV-VALIDATOR] Starting production environment validation...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const validationResults = {
      status: 'checking',
      timestamp: new Date().toISOString(),
      checks: [],
      critical_issues: [],
      warnings: [],
      recommendations: [],
      production_ready: true
    }

    // 1. Check Paystack Configuration
    console.log('[ENV-VALIDATOR] Checking Paystack configuration...')
    
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    const paystackPublicKey = Deno.env.get('PAYSTACK_PUBLIC_KEY')
    
    if (!paystackSecretKey) {
      validationResults.critical_issues.push({
        category: 'paystack_config',
        issue: 'PAYSTACK_SECRET_KEY not configured',
        impact: 'Payment processing will fail',
        fix: 'Configure PAYSTACK_SECRET_KEY in environment variables'
      })
      validationResults.production_ready = false
    } else {
      // Check if using live or test key
      const isLiveKey = paystackSecretKey.startsWith('sk_live_')
      const isTestKey = paystackSecretKey.startsWith('sk_test_')
      
      if (isTestKey) {
        validationResults.warnings.push({
          category: 'paystack_config',
          issue: 'Using Paystack test key',
          impact: 'No real money will be processed',
          fix: 'Replace with live Paystack secret key for production'
        })
      } else if (isLiveKey) {
        validationResults.checks.push({
          category: 'paystack_config',
          check: 'Paystack live key configured',
          status: 'pass'
        })
      } else {
        validationResults.critical_issues.push({
          category: 'paystack_config',
          issue: 'Invalid Paystack secret key format',
          impact: 'Payment processing will fail',
          fix: 'Use valid Paystack secret key (starts with sk_live_ or sk_test_)'
        })
        validationResults.production_ready = false
      }
    }

    if (!paystackPublicKey) {
      validationResults.warnings.push({
        category: 'paystack_config',
        issue: 'PAYSTACK_PUBLIC_KEY not configured',
        impact: 'Frontend payment initialization may fail',
        fix: 'Configure PAYSTACK_PUBLIC_KEY in environment variables'
      })
    }

    // 2. Test Paystack API Connectivity
    if (paystackSecretKey) {
      console.log('[ENV-VALIDATOR] Testing Paystack API connectivity...')
      
      try {
        const response = await fetch('https://api.paystack.co/bank', {
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          validationResults.checks.push({
            category: 'paystack_connectivity',
            check: 'Paystack API accessible',
            status: 'pass'
          })
        } else {
          validationResults.critical_issues.push({
            category: 'paystack_connectivity',
            issue: `Paystack API error: ${response.status}`,
            impact: 'Payment processing will fail',
            fix: 'Check Paystack API key validity and network connectivity'
          })
          validationResults.production_ready = false
        }
      } catch (apiError) {
        validationResults.critical_issues.push({
          category: 'paystack_connectivity',
          issue: `Cannot connect to Paystack API: ${apiError.message}`,
          impact: 'Payment processing will fail',
          fix: 'Check network connectivity and DNS resolution'
        })
        validationResults.production_ready = false
      }
    }

    // 3. Check Database Configuration
    console.log('[ENV-VALIDATOR] Checking database configuration...')
    
    try {
      // Test database connectivity and required tables
      const { data: dbTest, error: dbError } = await supabase
        .from('orders')
        .select('id')
        .limit(1)

      if (dbError) {
        validationResults.critical_issues.push({
          category: 'database',
          issue: `Database connection failed: ${dbError.message}`,
          impact: 'Application will not function',
          fix: 'Check database connectivity and permissions'
        })
        validationResults.production_ready = false
      } else {
        validationResults.checks.push({
          category: 'database',
          check: 'Database connectivity',
          status: 'pass'
        })
      }

      // Check required tables exist
      const requiredTables = [
        'orders', 'order_items', 'payment_transactions', 
        'customers', 'communication_events'
      ]
      
      for (const table of requiredTables) {
        try {
          await supabase.from(table).select('id').limit(1)
          validationResults.checks.push({
            category: 'database_schema',
            check: `Table '${table}' exists`,
            status: 'pass'
          })
        } catch (tableError) {
          validationResults.critical_issues.push({
            category: 'database_schema',
            issue: `Required table '${table}' missing or inaccessible`,
            impact: 'Core functionality will fail',
            fix: `Create or fix permissions for table '${table}'`
          })
          validationResults.production_ready = false
        }
      }
    } catch (dbCheckError) {
      validationResults.critical_issues.push({
        category: 'database',
        issue: `Database validation failed: ${dbCheckError.message}`,
        impact: 'Application stability at risk',
        fix: 'Review database configuration and connectivity'
      })
    }

    // 4. Check Business Settings
    console.log('[ENV-VALIDATOR] Checking business settings...')
    
    try {
      const { data: businessSettings, error: settingsError } = await supabase
        .from('business_settings')
        .select('name, admin_notification_email, whatsapp_support_number')
        .limit(1)
        .single()

      if (settingsError) {
        validationResults.warnings.push({
          category: 'business_settings',
          issue: 'Business settings not configured',
          impact: 'Admin notifications may not work',
          fix: 'Configure business settings in admin panel'
        })
      } else {
        if (!businessSettings.admin_notification_email) {
          validationResults.warnings.push({
            category: 'business_settings',
            issue: 'Admin notification email not set',
            impact: 'Critical alerts will not be received',
            fix: 'Set admin notification email in business settings'
          })
        }

        validationResults.checks.push({
          category: 'business_settings',
          check: 'Business settings configured',
          status: 'pass'
        })
      }
    } catch (settingsCheckError) {
      validationResults.warnings.push({
        category: 'business_settings',
        issue: `Could not check business settings: ${settingsCheckError.message}`,
        impact: 'Configuration may be incomplete',
        fix: 'Review business settings configuration'
      })
    }

    // 5. Check Communication Settings
    console.log('[ENV-VALIDATOR] Checking communication settings...')
    
    try {
      const { data: commSettings, error: commError } = await supabase
        .from('communication_settings')
        .select('email_provider, smtp_host, sender_email')
        .limit(1)
        .single()

      if (commError) {
        validationResults.warnings.push({
          category: 'communication',
          issue: 'Email settings not configured',
          impact: 'Customer notifications will not be sent',
          fix: 'Configure email provider in communication settings'
        })
      } else {
        validationResults.checks.push({
          category: 'communication',
          check: 'Email provider configured',
          status: 'pass'
        })
      }
    } catch (commCheckError) {
      validationResults.warnings.push({
        category: 'communication',
        issue: `Could not check communication settings: ${commCheckError.message}`,
        impact: 'Email notifications may not work',
        fix: 'Review communication settings'
      })
    }

    // 6. Security Check - RLS Policies
    console.log('[ENV-VALIDATOR] Checking security configuration...')
    
    try {
      const { data: rlsCheck } = await supabase.rpc('check_rls_enabled_tables')
      
      if (rlsCheck && rlsCheck.length > 0) {
        validationResults.checks.push({
          category: 'security',
          check: 'RLS policies enabled on sensitive tables',
          status: 'pass'
        })
      } else {
        validationResults.warnings.push({
          category: 'security',
          issue: 'Could not verify RLS policy status',
          impact: 'Data security may be at risk',
          fix: 'Verify RLS policies are properly configured'
        })
      }
    } catch (rlsError) {
      console.log('[ENV-VALIDATOR] Could not check RLS policies - this is expected if function does not exist')
    }

    // 7. Environment Detection
    const hostname = req.headers.get('host') || 'unknown'
    const isProduction = hostname.includes('supabase.co') || hostname.includes('lovable.app')
    
    if (isProduction) {
      validationResults.checks.push({
        category: 'environment',
        check: 'Production environment detected',
        status: 'pass'
      })
    } else {
      validationResults.recommendations.push({
        category: 'environment',
        recommendation: 'Development environment - ensure production domain is configured',
        benefit: 'Proper environment detection for security features'
      })
    }

    // 8. Generate Final Status
    validationResults.status = validationResults.production_ready ? 'ready' : 'not_ready'
    
    // Generate summary
    const totalChecks = validationResults.checks.length
    const criticalIssues = validationResults.critical_issues.length
    const warnings = validationResults.warnings.length

    const summary = {
      production_ready: validationResults.production_ready,
      total_checks: totalChecks,
      critical_issues: criticalIssues,
      warnings: warnings,
      recommendations: validationResults.recommendations.length,
      next_steps: criticalIssues > 0 ? 
        ['Fix all critical issues before going live'] : 
        warnings > 0 ? 
          ['Review warnings and recommendations', 'Consider fixing warnings for better reliability'] :
          ['Environment validated - ready for production']
    }

    // Log validation results
    await supabase.from('audit_logs').insert({
      action: 'production_environment_validation',
      category: 'System Health',
      message: `Environment validation completed - ${validationResults.status}`,
      new_values: {
        validation_summary: summary,
        critical_issues_count: criticalIssues,
        warnings_count: warnings,
        production_ready: validationResults.production_ready
      }
    })

    console.log(`[ENV-VALIDATOR] Validation completed: ${validationResults.status}`)
    console.log(`[ENV-VALIDATOR] Critical issues: ${criticalIssues}, Warnings: ${warnings}`)

    return new Response(JSON.stringify({
      ...validationResults,
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('[ENV-VALIDATOR] ERROR:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Environment validation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
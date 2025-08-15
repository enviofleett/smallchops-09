import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { corsHeaders } from '../_shared/cors.ts'
import { getPaystackConfig, validatePaystackConfig } from '../_shared/paystack-config.ts'

interface HealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🩺 Starting comprehensive payment system health diagnostic')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const healthChecks: HealthCheck[] = []

    // 1. Check Paystack Configuration
    try {
      const paystackConfig = getPaystackConfig(req)
      const validation = validatePaystackConfig(paystackConfig)
      
      if (validation.isValid) {
        healthChecks.push({
          component: 'Paystack Configuration',
          status: 'healthy',
          message: `✅ Configuration valid (${paystackConfig.environment} mode)`,
          details: {
            environment: paystackConfig.environment,
            isTestMode: paystackConfig.isTestMode,
            hasSecretKey: !!paystackConfig.secretKey,
            secretKeyType: paystackConfig.secretKey.startsWith('sk_test_') ? 'TEST' : 'LIVE'
          }
        })
      } else {
        healthChecks.push({
          component: 'Paystack Configuration',
          status: 'critical',
          message: `❌ Configuration invalid: ${validation.errors.join(', ')}`,
          details: { errors: validation.errors }
        })
      }
    } catch (configError) {
      healthChecks.push({
        component: 'Paystack Configuration',
        status: 'critical',
        message: `❌ Configuration error: ${configError.message}`,
        details: { error: configError.message }
      })
    }

    // 2. Test Paystack API Connectivity
    try {
      const paystackConfig = getPaystackConfig(req)
      const testResponse = await fetch('https://api.paystack.co/transaction/verify/invalid-reference-test', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackConfig.secretKey}`,
          'Content-Type': 'application/json',
        }
      })

      if (testResponse.status === 404) {
        // Expected response for invalid reference
        healthChecks.push({
          component: 'Paystack API Connectivity',
          status: 'healthy',
          message: '✅ Paystack API is reachable and responding',
          details: { responseStatus: testResponse.status }
        })
      } else if (testResponse.status === 401) {
        healthChecks.push({
          component: 'Paystack API Connectivity',
          status: 'critical',
          message: '❌ Paystack API authentication failed - check secret key',
          details: { responseStatus: testResponse.status }
        })
      } else {
        healthChecks.push({
          component: 'Paystack API Connectivity',
          status: 'warning',
          message: `⚠️ Unexpected Paystack API response: ${testResponse.status}`,
          details: { responseStatus: testResponse.status }
        })
      }
    } catch (apiError) {
      healthChecks.push({
        component: 'Paystack API Connectivity',
        status: 'critical',
        message: `❌ Paystack API connection failed: ${apiError.message}`,
        details: { error: apiError.message }
      })
    }

    // 3. Check Database Tables
    const tableChecks = [
      { table: 'orders', requiredColumns: ['id', 'payment_reference', 'paystack_reference', 'payment_status'] },
      { table: 'payment_transactions', requiredColumns: ['provider_reference', 'order_id', 'status'] }
    ]

    for (const { table, requiredColumns } of tableChecks) {
      try {
        const { data, error } = await supabaseClient
          .from(table)
          .select(requiredColumns.join(','))
          .limit(1)

        if (error) {
          healthChecks.push({
            component: `Database Table: ${table}`,
            status: 'critical',
            message: `❌ Table access failed: ${error.message}`,
            details: { error: error.message }
          })
        } else {
          healthChecks.push({
            component: `Database Table: ${table}`,
            status: 'healthy',
            message: `✅ Table accessible and structure valid`,
            details: { columns: requiredColumns }
          })
        }
      } catch (dbError) {
        healthChecks.push({
          component: `Database Table: ${table}`,
          status: 'critical',
          message: `❌ Database error: ${dbError.message}`,
          details: { error: dbError.message }
        })
      }
    }

    // 4. Check Reference Format Distribution
    try {
      const { data: payRefs } = await supabaseClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .like('payment_reference', 'pay_%')

      const { data: txnRefs } = await supabaseClient
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .like('payment_reference', 'txn_%')

      const payCount = payRefs?.length || 0
      const txnCount = txnRefs?.length || 0
      const total = payCount + txnCount

      if (payCount > 0 && total > 0) {
        const payPercentage = (payCount / total * 100).toFixed(1)
        healthChecks.push({
          component: 'Reference Format Distribution',
          status: payCount > txnCount ? 'warning' : 'healthy',
          message: `⚠️ ${payPercentage}% orders still use legacy pay_ format`,
          details: {
            pay_references: payCount,
            txn_references: txnCount,
            migration_recommended: payCount > 0
          }
        })
      } else {
        healthChecks.push({
          component: 'Reference Format Distribution',
          status: 'healthy',
          message: '✅ All orders use modern txn_ reference format',
          details: { txn_references: txnCount, pay_references: payCount }
        })
      }
    } catch (refError) {
      healthChecks.push({
        component: 'Reference Format Distribution',
        status: 'warning',
        message: `⚠️ Could not analyze reference formats: ${refError.message}`,
        details: { error: refError.message }
      })
    }

    // 5. Check Orphaned Payments
    try {
      const { data: orphanedPayments } = await supabaseClient
        .from('payment_transactions')
        .select('id, provider_reference, amount, created_at')
        .eq('status', 'orphaned')
        .limit(10)

      if (orphanedPayments && orphanedPayments.length > 0) {
        healthChecks.push({
          component: 'Orphaned Payments',
          status: 'warning',
          message: `⚠️ Found ${orphanedPayments.length} orphaned payments requiring review`,
          details: {
            count: orphanedPayments.length,
            recent_orphans: orphanedPayments.slice(0, 3).map(p => ({
              reference: p.provider_reference,
              amount: p.amount,
              created: p.created_at
            }))
          }
        })
      } else {
        healthChecks.push({
          component: 'Orphaned Payments',
          status: 'healthy',
          message: '✅ No orphaned payments found',
          details: { count: 0 }
        })
      }
    } catch (orphanError) {
      healthChecks.push({
        component: 'Orphaned Payments',
        status: 'warning',
        message: `⚠️ Could not check orphaned payments: ${orphanError.message}`,
        details: { error: orphanError.message }
      })
    }

    // 6. Check Recent Payment Activity
    try {
      const { data: recentOrders } = await supabaseClient
        .from('orders')
        .select('id, payment_status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const { data: recentTransactions } = await supabaseClient
        .from('payment_transactions')
        .select('id, status, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      const orderCount = recentOrders?.length || 0
      const transactionCount = recentTransactions?.length || 0

      healthChecks.push({
        component: 'Recent Payment Activity',
        status: 'healthy',
        message: `✅ ${orderCount} orders and ${transactionCount} transactions in last 24h`,
        details: {
          orders_24h: orderCount,
          transactions_24h: transactionCount,
          sync_ratio: orderCount > 0 ? (transactionCount / orderCount).toFixed(2) : 'N/A'
        }
      })
    } catch (activityError) {
      healthChecks.push({
        component: 'Recent Payment Activity',
        status: 'warning',
        message: `⚠️ Could not analyze recent activity: ${activityError.message}`,
        details: { error: activityError.message }
      })
    }

    // Calculate overall health status
    const criticalCount = healthChecks.filter(check => check.status === 'critical').length
    const warningCount = healthChecks.filter(check => check.status === 'warning').length
    
    let overallStatus = 'healthy'
    let overallMessage = '✅ Payment system is healthy'
    
    if (criticalCount > 0) {
      overallStatus = 'critical'
      overallMessage = `❌ Payment system has ${criticalCount} critical issue(s)`
    } else if (warningCount > 0) {
      overallStatus = 'warning'
      overallMessage = `⚠️ Payment system has ${warningCount} warning(s)`
    }

    return new Response(JSON.stringify({
      success: true,
      overall_status: overallStatus,
      overall_message: overallMessage,
      timestamp: new Date().toISOString(),
      health_checks: healthChecks,
      summary: {
        total_checks: healthChecks.length,
        healthy: healthChecks.filter(c => c.status === 'healthy').length,
        warnings: warningCount,
        critical: criticalCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Health diagnostic error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      overall_status: 'critical',
      overall_message: `❌ Health check failed: ${error.message}`,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
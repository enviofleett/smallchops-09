import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { corsHeaders } from '../_shared/cors.ts'

interface MigrationResult {
  success: boolean;
  processed: number;
  errors: number;
  details: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting payment recovery and migration process')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action } = await req.json()

    switch (action) {
      case 'migrate_references': {
        console.log('🔄 Migrating pay_ references to txn_ format')
        
        // Find all orders with pay_ references that need migration
        const { data: ordersToMigrate, error: fetchError } = await supabaseClient
          .from('orders')
          .select('id, payment_reference, order_number, total_amount, customer_email, created_at')
          .like('payment_reference', 'pay_%')
          .is('paystack_reference', null)
          .limit(100)

        if (fetchError) {
          throw new Error(`Failed to fetch orders: ${fetchError.message}`)
        }

        const result: MigrationResult = {
          success: true,
          processed: 0,
          errors: 0,
          details: []
        }

        for (const order of ordersToMigrate || []) {
          try {
            // Extract timestamp from pay_ reference and create txn_ reference
            const timestamp = Date.now()
            const newReference = `txn_${timestamp}_${crypto.randomUUID()}`
            
            // Update order with new reference format
            const { error: updateError } = await supabaseClient
              .from('orders')
              .update({
                paystack_reference: newReference,
                migration_notes: `Migrated from ${order.payment_reference} on ${new Date().toISOString()}`,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id)

            if (updateError) {
              throw new Error(`Failed to update order ${order.id}: ${updateError.message}`)
            }

            // Create payment transaction record for tracking
            await supabaseClient
              .from('payment_transactions')
              .insert({
                provider_reference: newReference,
                order_id: order.id,
                amount: order.total_amount,
                currency: 'NGN',
                status: 'migrated',
                gateway_response: 'Reference migrated from legacy format',
                metadata: {
                  original_reference: order.payment_reference,
                  migration_timestamp: new Date().toISOString(),
                  order_number: order.order_number
                }
              })

            result.processed++
            result.details.push(`✅ Migrated order ${order.order_number}: ${order.payment_reference} → ${newReference}`)
            
            console.log(`✅ Migrated order ${order.id}: ${order.payment_reference} → ${newReference}`)
            
          } catch (orderError) {
            result.errors++
            result.details.push(`❌ Failed to migrate order ${order.order_number}: ${orderError.message}`)
            console.error(`❌ Failed to migrate order ${order.id}:`, orderError)
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'recovery_status': {
        console.log('📊 Checking recovery status')
        
        // Count orders by reference format
        const { data: payOrders } = await supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .like('payment_reference', 'pay_%')

        const { data: txnOrders } = await supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .like('payment_reference', 'txn_%')

        const { data: pendingOrders } = await supabaseClient
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('payment_status', 'pending')

        const { data: orphanedPayments } = await supabaseClient
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'orphaned')

        return new Response(JSON.stringify({
          success: true,
          status: {
            pay_references: payOrders?.length || 0,
            txn_references: txnOrders?.length || 0,
            pending_orders: pendingOrders?.length || 0,
            orphaned_payments: orphanedPayments?.length || 0,
            migration_needed: (payOrders?.length || 0) > 0
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      case 'create_missing_transactions': {
        console.log('💾 Creating missing payment transaction records')
        
        // Find orders without payment transaction records
        const { data: ordersWithoutTransactions } = await supabaseClient
          .from('orders')
          .select('id, payment_reference, paystack_reference, total_amount, order_number, payment_status')
          .not('payment_reference', 'is', null)
          .limit(50)

        const result: MigrationResult = {
          success: true,
          processed: 0,
          errors: 0,
          details: []
        }

        for (const order of ordersWithoutTransactions || []) {
          try {
            const reference = order.paystack_reference || order.payment_reference
            
            // Check if transaction record already exists
            const { data: existing } = await supabaseClient
              .from('payment_transactions')
              .select('id')
              .eq('provider_reference', reference)
              .single()

            if (existing) {
              result.details.push(`⏭️ Transaction record already exists for order ${order.order_number}`)
              continue
            }

            // Create transaction record
            await supabaseClient
              .from('payment_transactions')
              .insert({
                provider_reference: reference,
                order_id: order.id,
                amount: order.total_amount,
                currency: 'NGN',
                status: order.payment_status === 'paid' ? 'paid' : 'pending',
                gateway_response: 'Transaction record created during recovery',
                metadata: {
                  order_number: order.order_number,
                  recovery_created: new Date().toISOString()
                }
              })

            result.processed++
            result.details.push(`✅ Created transaction record for order ${order.order_number}`)
            
          } catch (error) {
            result.errors++
            result.details.push(`❌ Failed to create transaction for order ${order.order_number}: ${error.message}`)
          }
        }

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Unknown action. Available actions: migrate_references, recovery_status, create_missing_transactions'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('❌ Payment recovery error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Recovery process failed',
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
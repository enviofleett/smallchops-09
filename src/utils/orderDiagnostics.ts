import { supabase } from "@/integrations/supabase/client";
import { verifyPaystackTransaction } from "./paystackVerifyTest";
import { runPaystackBatchVerify } from "./paystackBatchVerify";

/**
 * Diagnostic and recovery utility for pending orders
 */
export class OrderDiagnostics {
  
  /**
   * Diagnose and attempt to recover a specific order
   */
  static async diagnoseAndRecover(orderNumber: string) {
    console.log(`🔍 Diagnosing order: ${orderNumber}`);
    
    // Step 1: Get current order status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        payment_reference,
        total_amount,
        amount_kobo,
        paid_at,
        idempotency_key,
        processing_lock
      `)
      .eq('order_number', orderNumber)
      .single();

    if (orderError) {
      console.error('❌ Order not found:', orderError);
      return { success: false, error: 'Order not found' };
    }

    console.log('📋 Current order status:', order);

    // Step 2: Get payment transaction status
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('order_id', order.id)
      .single();

    console.log('💳 Payment transaction:', transaction);

    // Step 3: Check communication events
    const { data: events } = await supabase
      .from('communication_events')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false });

    console.log('📧 Communication events:', events);

    // Step 4: If order is pending and has payment reference, try verification
    if (order.status === 'pending' && order.payment_reference) {
      console.log(`🔄 Attempting payment verification for reference: ${order.payment_reference}`);
      
      const verificationResult = await verifyPaystackTransaction(order.payment_reference);
      console.log('✅ Verification result:', verificationResult);
      
      if (verificationResult.error) {
        console.log('⚠️ Direct verification failed, trying batch verifier...');
        
        // Step 5: Try batch verification as fallback
        const batchResult = await runPaystackBatchVerify({
          excludeOrderNumbers: [], // Don't exclude this order
          limit: 1,
          dryRun: false
        });
        
        console.log('🔄 Batch verification result:', batchResult);
      }
    }

    // Step 6: Re-check order status after attempts
    const { data: updatedOrder } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        payment_status,
        payment_reference,
        total_amount,
        amount_kobo,
        paid_at,
        updated_at
      `)
      .eq('order_number', orderNumber)
      .single();

    console.log('🔄 Updated order status:', updatedOrder);

    // Step 7: Generate diagnostic report
    const diagnosticReport = {
      orderNumber,
      initialStatus: {
        order_status: order.status,
        payment_status: order.payment_status,
        payment_reference: order.payment_reference,
        amount: order.total_amount,
        amount_kobo: order.amount_kobo,
        paid_at: order.paid_at
      },
      finalStatus: {
        order_status: updatedOrder?.status,
        payment_status: updatedOrder?.payment_status,
        paid_at: updatedOrder?.paid_at,
        last_updated: updatedOrder?.updated_at
      },
      hasTransaction: !!transaction,
      communicationEvents: events?.length || 0,
      recoveryAttempted: true,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Diagnostic Report:', diagnosticReport);
    
    return {
      success: true,
      report: diagnosticReport,
      recovered: updatedOrder?.status === 'confirmed'
    };
  }

  /**
   * Quick status check for multiple orders
   */
  static async quickCheck(orderNumbers: string[]) {
    const { data: orders } = await supabase
      .from('orders')
      .select('order_number, status, payment_status, payment_reference, total_amount, paid_at')
      .in('order_number', orderNumbers);

    return orders?.map(order => ({
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      hasPaymentRef: !!order.payment_reference,
      amount: order.total_amount,
      isPaid: !!order.paid_at
    }));
  }
}

/**
 * Console helper for quick diagnostics
 * Usage: diagnoseOrder('ORD17558639864c0bf0')
 */
export async function diagnoseOrder(orderNumber: string) {
  return await OrderDiagnostics.diagnoseAndRecover(orderNumber);
}
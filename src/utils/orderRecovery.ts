// ========================================
// 🔧 ORDER RECOVERY UTILITIES
// ========================================

import { supabase } from "@/integrations/supabase/client";

/**
 * Recover the pending order ORD-20250812-1434
 */
export const recoverPendingOrder = async () => {
  console.log('🔄 Attempting to recover pending order...');
  
  try {
    // Check if the problematic order exists
    const { data: pendingOrder, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_number', 'ORD-20250812-1434')
      .single();
    
    if (orderError) {
      console.log('❌ Pending order not found:', orderError);
      return { success: false, error: 'Order not found' };
    }
    
    console.log('📋 Found pending order:', pendingOrder);
    
    // Check if there's a payment transaction for this order
    const paystackRef = 'pay_1755020881006_zo5vbldke';
    
    // Generate proper txn_ reference for the order
    const properReference = `txn_1755020881006_${pendingOrder.id}`;
    
    // Update the order with proper reference format
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_reference: properReference,
        paystack_reference: paystackRef,
        updated_at: new Date().toISOString()
      })
      .eq('id', pendingOrder.id);
    
    if (updateError) {
      console.error('❌ Failed to update order:', updateError);
      return { success: false, error: updateError.message };
    }
    
    console.log('✅ Order updated with proper reference format');
    
    // Try to verify payment status with Paystack
    try {
      const { data: verificationResult, error: verifyError } = await supabase.functions
        .invoke('paystack-secure', {
          body: {
            action: 'verify',
            reference: paystackRef
          }
        });
      
      if (!verifyError && verificationResult?.success) {
        console.log('✅ Payment verified, updating order status');
        
        // Update order to paid status
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            paid_at: new Date().toISOString()
          })
          .eq('id', pendingOrder.id);
        
        return { success: true, message: 'Order recovered and marked as paid' };
      } else {
        console.log('⚠️ Payment not found on Paystack, order remains pending');
        return { success: true, message: 'Order reference updated, payment verification failed' };
      }
    } catch (verifyError) {
      console.warn('⚠️ Could not verify payment:', verifyError);
      return { success: true, message: 'Order reference updated, payment verification skipped' };
    }
    
  } catch (error) {
    console.error('❌ Order recovery failed:', error);
    return { success: false, error: (error as Error).message };
  }
};
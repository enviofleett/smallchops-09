// ========================================
// 🔧 FRONTEND REFERENCE FORMAT FIX
// Align with Backend txn_ Format
// ========================================

import { generateSecureToken } from './crypto';

/**
 * Generate payment reference in txn_ format to match backend expectations
 */
export const generatePaymentReference = (): string => {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID ? crypto.randomUUID() : generateFallbackUUID();
  return `txn_${timestamp}_${uuid}`;
};

/**
 * Fallback UUID generation for older browsers
 */
const generateFallbackUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Validate if a reference follows the expected txn_ format
 */
export const isValidPaymentReference = (reference: string): boolean => {
  return reference.startsWith('txn_') && reference.length > 10;
};

/**
 * Find order by reference with backward compatibility
 */
export const findOrderByReference = async (reference: string, supabase: any) => {
  console.log('🔍 Looking up order by reference:', reference);
  
  // Try to find order by multiple reference formats
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .or(`payment_reference.eq.${reference},paystack_reference.eq.${reference}`)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('❌ Order lookup error:', error);
    throw error;
  }
  
  if (!order) {
    console.warn('⚠️ No order found for reference:', reference);
    return null;
  }
  
  console.log('✅ Order found:', order);
  return order;
};

/**
 * Migration helper to check for orders needing reference updates
 */
export const checkOrderReferenceMigration = async (supabase: any) => {
  console.log('🔄 Checking order reference migration status...');
  
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, payment_reference, created_at, payment_status')
      .is('paystack_reference', null)
      .or('payment_reference.like.checkout_%,payment_reference.like.pay_%')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()); // Last 48 hours
    
    if (error) throw error;
    
    console.log(`📋 Found ${orders?.length || 0} orders with old reference format`);
    
    return {
      success: true,
      ordersNeedingReview: orders?.length || 0,
      orders: orders || []
    };
    
  } catch (error) {
    console.error('❌ Migration check failed:', error);
    return {
      success: false,
      error: (error as Error).message
    };
  }
};
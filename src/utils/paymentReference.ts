// ========================================
// 🔧 EMERGENCY PAYMENT REFERENCE FIX
// Frontend Reference Generation ELIMINATED
// ========================================

/**
 * CRITICAL: Frontend CANNOT generate references anymore
 * Only backend has authority to generate txn_ references
 */

/**
 * STRICT validation - only allows backend-generated txn_ references
 */
export const isValidPaymentReference = (reference: string): boolean => {
  if (!reference || typeof reference !== 'string') return false;
  
  // ONLY backend txn_ format is allowed
  const backendFormat = /^txn_\d+_[a-f0-9-]{36}$/;
  const isValid = backendFormat.test(reference);
  
  // Log and reject any invalid format attempts
  if (!isValid) {
    console.error('🚨 INVALID REFERENCE FORMAT DETECTED:', {
      reference,
      expected: 'txn_[timestamp]_[uuid]',
      source: 'frontend_validation'
    });
  }
  
  return isValid;
};

/**
 * Strict backend-only reference validation
 */
export const validateBackendReference = (reference: string): boolean => {
  return isValidPaymentReference(reference);
};

/**
 * Reject any pay_ references immediately
 */
export const rejectClientReference = (reference: string): boolean => {
  if (reference?.startsWith('pay_')) {
    console.error('🚨 CLIENT REFERENCE REJECTED:', reference);
    throw new Error('Client-generated references are deprecated. Backend must generate all references.');
  }
  return true;
};

/**
 * Extract timestamp from payment reference
 */
export const extractTimestamp = (reference: string): number | null => {
  const match = reference.match(/^(?:txn|pay)_(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Check if reference is recent (within max age)
 */
export const isRecentReference = (reference: string, maxAgeMs = 24 * 60 * 60 * 1000): boolean => {
  const timestamp = extractTimestamp(reference);
  if (!timestamp) return false;
  
  return Date.now() - timestamp <= maxAgeMs;
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
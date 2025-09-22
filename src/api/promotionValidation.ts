import { supabase } from '@/integrations/supabase/client';

export interface PromotionValidationRequest {
  code: string;
  order_amount: number;
  customer_email?: string;
  customer_id?: string;
  cart_items?: any[];
}

export interface PromotionValidationResponse {
  success: boolean;
  promotion?: any;
  discount_amount?: number;
  message?: string;
  error?: string;
  bogo_items?: any[];
  rate_limited?: boolean;
  attempts_remaining?: number;
}

// Production-ready promotion code validation with enhanced security
export async function validatePromotionCodeSecure(
  request: PromotionValidationRequest
): Promise<PromotionValidationResponse> {
  try {
    console.log('🔒 Validating promotion code securely:', request.code);

    // Call the secure edge function for validation
    const { data, error } = await supabase.functions.invoke('validate-promotion-code', {
      body: request
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      return {
        success: false,
        error: 'Validation service unavailable. Please try again.',
      };
    }

    console.log('✅ Promotion validation response:', data);
    return data;

  } catch (error) {
    console.error('❌ Promotion validation network error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection and try again.',
    };
  }
}

// Enhanced promotion code validation with client-side rate limiting awareness
export async function validatePromotionCode(
  code: string, 
  orderAmount: number,
  customerEmail?: string,
  customerId?: string,
  cartItems?: any[]
): Promise<{ 
  valid: boolean; 
  promotion?: any; 
  discount_amount?: number; 
  error?: string;
  rate_limited?: boolean;
  attempts_remaining?: number;
  bogo_items?: any[];
}> {
  try {
    // Input validation
    if (!code || !code.trim()) {
      return { 
        valid: false, 
        error: 'Please enter a promotion code' 
      };
    }

    if (!orderAmount || orderAmount <= 0) {
      return { 
        valid: false, 
        error: 'Invalid order amount' 
      };
    }

    // Use the secure validation
    const result = await validatePromotionCodeSecure({
      code: code.trim().toUpperCase(),
      order_amount: orderAmount,
      customer_email: customerEmail,
      customer_id: customerId,
      cart_items: cartItems
    });

    if (!result.success) {
      return {
        valid: false,
        error: result.error,
        rate_limited: result.rate_limited,
        attempts_remaining: result.attempts_remaining
      };
    }

    return {
      valid: true,
      promotion: result.promotion,
      discount_amount: result.discount_amount,
      bogo_items: result.bogo_items,
      attempts_remaining: result.attempts_remaining
    };

  } catch (error) {
    console.error('❌ Promotion validation error:', error);
    return { 
      valid: false, 
      error: 'Failed to validate promotion code. Please try again.' 
    };
  }
}

// Track promotion usage when order is completed
export async function trackPromotionUsage(
  promotionId: string,
  orderId: string,
  customerEmail: string,
  discountAmount: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('promotion_usage')
      .insert({
        promotion_id: promotionId,
        order_id: orderId,
        customer_email: customerEmail,
        discount_amount: discountAmount,
        used_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Failed to track promotion usage:', error);
    } else {
      console.log('✅ Promotion usage tracked successfully');
    }
  } catch (error) {
    console.error('❌ Promotion usage tracking error:', error);
  }
}
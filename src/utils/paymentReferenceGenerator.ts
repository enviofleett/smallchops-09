import { supabase } from '@/integrations/supabase/client';

export interface PaymentIntentResult {
  success: boolean;
  intent_id?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  error?: string;
}

/**
 * Creates a payment intent with server-generated reference
 * This replaces client-side reference generation to ensure consistency
 */
export async function createPaymentIntent(
  orderId: string,
  amount: number,
  currency: string = 'NGN'
): Promise<PaymentIntentResult> {
  try {
    console.log('🔑 Creating payment intent for order:', orderId);
    
    const { data, error } = await supabase.rpc('create_payment_intent', {
      p_order_id: orderId,
      p_amount: amount,
      p_currency: currency
    });

    if (error) {
      console.error('❌ Payment intent creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }

    if (!data.success) {
      console.error('❌ Payment intent creation rejected:', data.error);
      return {
        success: false,
        error: data.error
      };
    }

    console.log('✅ Payment intent created successfully:', data.reference);
    
    return {
      success: true,
      intent_id: data.intent_id,
      reference: data.reference,
      amount: data.amount,
      currency: data.currency
    };

  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Migrates existing pay_* references to txn_* format
 * Should be run once during deployment
 */
export async function migratePaymentReferences(): Promise<{
  success: boolean;
  updated_orders?: number;
  message?: string;
  error?: string;
}> {
  try {
    console.log('🔄 Starting payment reference migration...');
    
    const { data, error } = await supabase.rpc('migrate_payment_references');

    if (error) {
      console.error('❌ Migration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log('✅ Migration completed:', data);
    
    return {
      success: true,
      updated_orders: data.updated_orders,
      message: data.message
    };

  } catch (error) {
    console.error('❌ Migration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
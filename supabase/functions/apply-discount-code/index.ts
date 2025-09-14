import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplyDiscountRequest {
  discount_code_id: string;
  order_id?: string;
  customer_email: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  ip_address?: string;
  user_agent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      discount_code_id, 
      order_id, 
      customer_email, 
      discount_amount, 
      original_amount, 
      final_amount,
      ip_address,
      user_agent 
    }: ApplyDiscountRequest = await req.json();

    // Validation helper function
    function validateDiscountRequest(discountCodeId: string, email: string, discountAmount: number, originalAmount: number, finalAmount: number): boolean {
      if (!discountCodeId || typeof discountCodeId !== 'string') {
        console.error('Invalid discount_code_id:', discountCodeId);
        return false;
      }
      
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        console.error('Invalid customer_email:', email);
        return false;
      }
      
      if (typeof discountAmount !== 'number' || discountAmount < 0) {
        console.error('Invalid discount_amount:', discountAmount);
        return false;
      }
      
      if (typeof originalAmount !== 'number' || originalAmount < 0) {
        console.error('Invalid original_amount:', originalAmount);
        return false;
      }
      
      if (typeof finalAmount !== 'number' || finalAmount < 0) {
        console.error('Invalid final_amount:', finalAmount);
        return false;
      }
      
      return true;
    }

    console.log('Apply discount request:', { 
      discount_code_id, 
      customer_email, 
      discount_amount, 
      original_amount, 
      final_amount 
    });

    if (!discount_code_id || !customer_email || !discount_amount || !original_amount || !final_amount) {
      console.error('Missing required fields:', { 
        has_discount_code_id: !!discount_code_id,
        has_customer_email: !!customer_email,
        has_discount_amount: !!discount_amount,
        has_original_amount: !!original_amount,
        has_final_amount: !!final_amount
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // discount_code_id should already be a UUID from validation step
    const actualDiscountCodeId = discount_code_id;
    console.log('Using discount code ID:', actualDiscountCodeId);

        // Validate that we have all required fields
        if (!validateDiscountRequest(actualDiscountCodeId, customer_email, discount_amount, original_amount, final_amount)) {
          return new Response(
            JSON.stringify({ error: 'Invalid discount application data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Record the discount usage with proper UUID and error handling
        const { data: usage, error: usageError } = await supabase
          .from('discount_code_usage')
          .insert({
            discount_code_id: actualDiscountCodeId,
            order_id,
            customer_email,
            discount_amount,
            original_amount,
            final_amount,
            ip_address,
            user_agent
          })
          .select()
          .single();

        if (usageError) {
          console.error('Usage recording error:', usageError);
          
          // Log the failure for audit
          await supabase.from('audit_logs').insert({
            action: 'discount_usage_recording_failed',
            category: 'Promotion Processing',
            message: `Failed to record discount usage for code ${discount_code_id}`,
            entity_id: actualDiscountCodeId,
            new_values: { 
              error: usageError.message,
              customer_email,
              discount_amount,
              original_amount,
              final_amount 
            }
          });
          
          return new Response(
            JSON.stringify({ error: 'Failed to record discount usage' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

    // Update usage count using database function for atomicity
    const { error: updateError } = await supabase.rpc('increment_discount_usage_count', {
      p_discount_code_id: actualDiscountCodeId
    });

    if (updateError) {
      console.error('Usage count update error:', updateError);
      // Log error but don't fail the transaction as usage was already recorded
      await supabase.from('audit_logs').insert({
        action: 'discount_usage_count_update_failed',
        category: 'Promotion Processing',
        message: `Failed to update usage count for discount code ${discount_code_id}`,
        entity_id: actualDiscountCodeId,
        new_values: { error: updateError.message }
      });
    }

    // Log the application for audit trail with proper UUID
    await supabase.from('audit_logs').insert({
      action: 'discount_code_applied',
      category: 'Promotion Processing',
      message: `Discount code ${discount_code_id} applied for customer ${customer_email}`,
      entity_id: actualDiscountCodeId,
      new_values: {
        discount_code: discount_code_id,
        customer_email,
        discount_amount,
        original_amount,
        final_amount,
        order_id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        usage_id: usage.id,
        message: 'Discount applied successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apply discount error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
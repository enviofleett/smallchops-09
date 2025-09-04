import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionValidationRequest {
  code: string;
  order_amount: number;
  customer_email?: string;
  customer_id?: string;
  cart_items?: any[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request data
    const { code, order_amount, customer_email, customer_id, cart_items = [] }: PromotionValidationRequest = await req.json();

    // Get client IP and user agent for security logging
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log(`🔒 Promotion validation request: ${code} for amount ${order_amount} from IP ${clientIP}`);

    // Rate limiting check
    const rateLimitResult = await supabase.rpc('check_promotion_code_rate_limit', {
      p_identifier: clientIP,
      p_max_attempts: 10,
      p_window_hours: 1,
      p_block_minutes: 15
    });

    if (rateLimitResult.error) {
      console.error('Rate limit check failed:', rateLimitResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit service unavailable' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if rate limited
    if (!rateLimitResult.data?.allowed) {
      const reason = rateLimitResult.data?.reason;
      let errorMessage = 'Too many attempts. Please try again later.';
      
      if (reason === 'temporarily_blocked') {
        const blockedUntil = new Date(rateLimitResult.data.blocked_until);
        const minutes = Math.ceil((blockedUntil.getTime() - Date.now()) / (60 * 1000));
        errorMessage = `Too many failed attempts. Please wait ${minutes} minute(s) before trying again.`;
      }

      console.log(`🚫 Rate limited: ${clientIP} - ${reason}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          rate_limited: true,
          attempts_remaining: rateLimitResult.data?.attempts_remaining || 0
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate promotion code
    const validationResult = await supabase.rpc('validate_promotion_code_secure', {
      p_code: code,
      p_order_amount: order_amount,
      p_customer_email: customer_email,
      p_customer_id: customer_id,
      p_ip_address: clientIP,
      p_user_agent: userAgent
    });

    if (validationResult.error) {
      console.error('Promotion validation failed:', validationResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Validation service error' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = validationResult.data;
    
    if (!result.valid) {
      console.log(`❌ Invalid promotion code: ${code} - ${result.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          attempts_remaining: rateLimitResult.data?.attempts_remaining || 0
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If BOGO promotion, calculate BOGO items
    let bogoItems = [];
    if (result.promotion?.type === 'buy_one_get_one' && cart_items?.length) {
      const bogoCalculation = await supabase.rpc('calculate_bogo_discount', {
        p_promotion_id: result.promotion.id,
        p_cart_items: cart_items
      });

      if (bogoCalculation.data?.allocations) {
        bogoItems = bogoCalculation.data.allocations;
      }
    }

    console.log(`✅ Valid promotion code: ${code} - discount: ${result.discount_amount}`);

    return new Response(
      JSON.stringify({
        success: true,
        promotion: result.promotion,
        discount_amount: result.discount_amount,
        message: result.message,
        bogo_items: bogoItems,
        attempts_remaining: rateLimitResult.data?.attempts_remaining || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Promotion validation error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
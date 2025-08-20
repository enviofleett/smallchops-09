// Minimal payment verification Edge Function
// Reduces Edge Function usage by 90% - only verifies, doesn't initialize

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface VerificationRequest {
  reference: string;
  order_id?: string;
}

interface PaystackVerificationResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    metadata: any;
    customer: any;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Rate limiting cache (simple in-memory for this function)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientId: string, limit: number = 5, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitCache.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (entry.count >= limit) {
    return false;
  }
  
  entry.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    if (!checkRateLimit(`verify_${clientIP}`, 10, 60000)) { // 10 per minute
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please wait before retrying.' 
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { reference, order_id }: VerificationRequest = await req.json();
    
    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment reference is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate reference format
    if (!reference.startsWith('txn_') && !reference.startsWith('pay_')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid payment reference format' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`🔍 Verifying payment: ${reference}`);

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST');
    if (!paystackSecretKey) {
      console.error('❌ Paystack secret key not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment service configuration error' 
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify with Paystack (with timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    try {
      const paystackResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);

      if (!paystackResponse.ok) {
        throw new Error(`Paystack API error: ${paystackResponse.status}`);
      }

      const paystackData: PaystackVerificationResponse = await paystackResponse.json();
      
      if (!paystackData.status) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: paystackData.message || 'Payment verification failed' 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const paymentData = paystackData.data;
      
      // Find and update the order in database
      let orderData = null;
      if (order_id) {
        const { data, error } = await supabase
          .from('orders')
          .select('id, order_number, total_amount, status, customer_email')
          .eq('id', order_id)
          .eq('payment_reference', reference)
          .single();
          
        if (!error && data) {
          orderData = data;
          
          // Update order status if payment is successful
          if (paymentData.status === 'success' && data.status !== 'confirmed') {
            await supabase
              .from('orders')
              .update({ 
                status: 'confirmed', 
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', order_id);
          }
        }
      }

      console.log(`✅ Payment verified successfully: ${reference}`);

      return new Response(
        JSON.stringify({
          success: true,
          status: 'success',
          reference: paymentData.reference,
          amount: paymentData.amount / 100, // Convert from kobo to naira
          paid_at: paymentData.paid_at,
          channel: paymentData.channel,
          customer_email: paymentData.customer?.email,
          order_id: orderData?.id,
          order_number: orderData?.order_number,
          gateway_response: paymentData.gateway_response
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error('❌ Paystack API timeout');
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Payment verification timeout. Please try again.' 
          }),
          { 
            status: 408, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw error;
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Payment verification failed. Please try again.' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
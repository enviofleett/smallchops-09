import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// Import environment detection
import { getPaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

// Paystack's official webhook IP addresses
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169', 
  '52.214.14.220',
  '13.248.121.73'  // Additional Paystack server
]

// Verify webhook origin by IP
function verifyPaystackIP(request: Request): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  // Extract all possible IPs (handle comma-separated lists)
  const allIPs = []
  if (cfConnectingIP) allIPs.push(cfConnectingIP.trim())
  if (realIP) allIPs.push(realIP.trim())
  if (forwardedFor) {
    // Handle comma-separated IPs in x-forwarded-for
    const forwardedIPs = forwardedFor.split(',').map(ip => ip.trim())
    allIPs.push(...forwardedIPs)
  }
  
  if (allIPs.length === 0) {
    console.warn('Could not determine client IP from headers')
    return false
  }
  
  console.log(`🔍 Webhook request from IPs: ${allIPs.join(', ')}`)
  console.log(`📋 Checking against whitelist: ${PAYSTACK_IPS.join(', ')}`)
  
  // Check if any of the IPs match our whitelist
  const validIP = allIPs.find(ip => PAYSTACK_IPS.includes(ip))
  
  if (validIP) {
    console.log(`✅ Valid Paystack IP found: ${validIP}`)
    return true
  } else {
    console.log(`🚫 No valid Paystack IPs found in: ${allIPs.join(', ')}`)
    return false
  }
}

// Verify signature using secret key
async function verifyPaystackSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    
    const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const hashArray = Array.from(new Uint8Array(hash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex === signature
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    
    // Get environment-aware configuration
    const paystackConfig = getPaystackConfig(req);
    logPaystackConfigStatus(paystackConfig);
    
    // Security validation
    const isValidIP = verifyPaystackIP(req);
    let isValidSignature = false;
    
    if (signature && paystackConfig.webhookSecret) {
      isValidSignature = await verifyPaystackSignature(payload, signature, paystackConfig.webhookSecret);
    }
    
    // Allow if either IP is valid OR signature is valid
    if (!isValidIP && !isValidSignature) {
      console.error('Webhook security validation failed');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    
    console.log(`Webhook verified via: ${isValidIP ? 'IP' : ''}${isValidIP && isValidSignature ? ' + ' : ''}${isValidSignature ? 'Signature' : ''}`);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = JSON.parse(payload);
    const event = body.event;
    const data = body.data;

    console.log('Webhook received:', event, 'for reference:', data.reference);

    if (event === 'charge.success') {
      // Get payment transaction with fallback creation
      let { data: transaction, error: transactionError } = await supabaseAdmin
        .from('payment_transactions')
        .select('*, orders(*)')
        .eq('provider_reference', data.reference)
        .single();

      if (transactionError || !transaction) {
        console.log('🔍 Transaction not found, attempting to find order by reference:', data.reference);
        
        // Try to find order by payment reference and create transaction record
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('payment_reference', data.reference)
          .single();
        
        if (order && !orderError) {
          console.log('📝 Creating missing payment transaction record for order:', order.order_number);
          
          // Create the missing transaction record
          const { data: newTransaction, error: createError } = await supabaseAdmin
            .from('payment_transactions')
            .insert({
              provider_reference: data.reference,
              order_id: order.id,
              amount: data.amount / 100, // Convert from kobo
              currency: data.currency || 'NGN',
              status: 'pending',
              gateway_response: 'Transaction created via webhook',
              metadata: data.metadata,
              created_at: new Date().toISOString()
            })
            .select('*, orders(*)')
            .single();
          
          if (!createError && newTransaction) {
            transaction = newTransaction;
            console.log('✅ Payment transaction record created successfully');
          } else {
            console.error('❌ Failed to create transaction record:', createError);
            return new Response('Failed to create transaction record', { status: 500, headers: corsHeaders });
          }
        } else {
          console.error('❌ Order not found for reference:', data.reference);
          return new Response('Order not found', { status: 404, headers: corsHeaders });
        }
      }

      // Update payment status
      await supabaseAdmin
        .from('payment_transactions')
        .update({ 
          status: 'success',
          paid_at: new Date().toISOString(),
          provider_response: data
        })
        .eq('id', transaction.id);

      // Update order status
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'processing'
        })
        .eq('id', transaction.order_id);

      // Send payment confirmation email using templates
      const order = transaction.orders;
      if (order) {
        try {
          await supabaseAdmin.functions.invoke('unified-smtp-sender', {
            body: {
              to: order.customer_email,
              template_key: 'payment_confirmation',
              variables: {
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                order_number: order.order_number,
                order_total: `₦${order.total_amount.toLocaleString()}`,
                payment_reference: data.reference,
                order_date: new Date().toLocaleDateString(),
                store_name: 'Your Store',
                store_url: 'https://your-store.com',
                support_email: 'support@your-store.com',
                payment_amount: `₦${(data.amount / 100).toLocaleString()}`,
                payment_method: data.channel
              },
              priority: 'high'
            }
          });
          console.log('Payment confirmation email sent via template to:', order.customer_email);
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
        }

        // Send admin notification using templates
        try {
          await supabaseAdmin.functions.invoke('unified-smtp-sender', {
            body: {
              to: 'admin@your-store.com',
              template_key: 'admin_new_order',
              variables: {
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                order_number: order.order_number,
                order_total: `₦${order.total_amount.toLocaleString()}`,
                payment_reference: data.reference,
                order_date: new Date().toLocaleDateString(),
                store_name: 'Your Store',
                store_url: 'https://your-store.com',
                support_email: 'support@your-store.com',
                fulfillment_type: order.order_type,
                payment_amount: `₦${(data.amount / 100).toLocaleString()}`,
                payment_method: data.channel
              },
              priority: 'high'
            }
          });
          console.log('Admin notification sent via template for order:', order.order_number);
        } catch (adminEmailError) {
          console.error('Failed to send admin notification:', adminEmailError);
        }
      }

      console.log('Payment webhook processed successfully');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('Event not handled', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Error processing webhook', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
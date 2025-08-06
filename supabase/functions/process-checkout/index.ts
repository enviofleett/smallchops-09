import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  order_items: Array<{
    product_id: string;
    quantity: number;
    price?: number;
    unit_price?: number;
    total_price?: number;
    discount_amount?: number;
  }>;
  total_amount?: number;
  delivery_fee?: number;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone?: string;
    delivery_instructions?: string;
  };
  pickup_point_id?: string;
  guest_session_id?: string;
  payment_method: 'bank_transfer' | 'cash_on_delivery' | 'paystack';
}

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
}

// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to clean and validate UUID
function cleanUUID(value: any): string | null {
  if (!value || value === 'null' || value === 'undefined') return null;
  
  if (typeof value !== 'string') return null;
  
  const cleaned = value.trim().replace(/^guest_/, '');
  return isValidUUID(cleaned) ? cleaned : null;
}

// Helper function to find or create customer account
async function findOrCreateCustomer(
  supabase: any,
  email: string,
  name: string,
  phone?: string
): Promise<{ customer_id: string; isNew: boolean }> {
  console.log(`🔍 Looking for existing customer: ${email}`);
  
  // First, try to find existing customer account
  const { data: existingCustomer, error: findError } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) {
    console.error('❌ Error finding customer:', findError);
    throw new Error(`Failed to find customer: ${findError.message}`);
  }

  if (existingCustomer) {
    console.log(`✅ Found existing customer: ${existingCustomer.id}`);
    return { customer_id: existingCustomer.id, isNew: false };
  }

  console.log(`👤 Creating new customer account for: ${email}`);
  
  // Create new customer account
  const { data: newCustomer, error: createError } = await supabase
    .from('customer_accounts')
    .insert({
      name,
      email,
      phone: phone || null,
      user_id: crypto.randomUUID(), // Generate temporary user_id for guest
      email_verified: false,
      phone_verified: false,
      profile_completion_percentage: 30
    })
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Error creating customer:', createError);
    throw new Error(`Failed to create customer: ${createError.message}`);
  }

  console.log(`✅ Created new customer: ${newCustomer.id}`);
  return { customer_id: newCustomer.id, isNew: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const checkoutData: CheckoutRequest = await req.json();
    console.log('📦 Processing checkout request:', {
      customer_email: checkoutData.customer_email,
      customer_name: checkoutData.customer_name,
      fulfillment_type: checkoutData.fulfillment_type,
      items_count: checkoutData.order_items?.length || 0,
      payment_method: checkoutData.payment_method
    });

    // Validate required fields
    if (!checkoutData.customer_email || !checkoutData.customer_name || !checkoutData.order_items || checkoutData.order_items.length === 0) {
      console.error('❌ Missing required fields:', { 
        hasEmail: !!checkoutData.customer_email, 
        hasName: !!checkoutData.customer_name,
        hasItems: !!(checkoutData.order_items && checkoutData.order_items.length > 0)
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: customer_email, customer_name, and order_items are required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate order items structure
    for (const [index, item] of checkoutData.order_items.entries()) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        console.error(`❌ Invalid item at index ${index}:`, item);
        return new Response(
          JSON.stringify({ error: `Item ${index + 1}: product_id and positive quantity are required` }),
          { status: 400, headers: corsHeaders }
        );
      }
      
      if (!isValidUUID(item.product_id)) {
        console.error(`❌ Invalid product_id UUID at index ${index}:`, item.product_id);
        return new Response(
          JSON.stringify({ error: `Item ${index + 1}: product_id must be a valid UUID` }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Find or create customer account
    const { customer_id, isNew: isNewCustomer } = await findOrCreateCustomer(
      supabaseClient,
      checkoutData.customer_email,
      checkoutData.customer_name,
      checkoutData.customer_phone
    );

    // Transform order items to match database function expectations
    const transformedItems: OrderItem[] = checkoutData.order_items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price || item.price || 0,
      discount_amount: item.discount_amount || 0
    }));

    // Clean and validate UUIDs
    const cleanGuestSessionId = cleanUUID(checkoutData.guest_session_id);
    const cleanDeliveryZoneId = cleanUUID(checkoutData.delivery_zone_id);
    const cleanPickupPointId = cleanUUID(checkoutData.pickup_point_id);

    console.log('🔧 Transformed parameters:', {
      customer_id,
      fulfillment_type: checkoutData.fulfillment_type,
      delivery_zone_id: cleanDeliveryZoneId,
      pickup_point_id: cleanPickupPointId,
      guest_session_id: cleanGuestSessionId,
      items_count: transformedItems.length
    });

    // Validate pickup point for pickup orders
    if (checkoutData.fulfillment_type === 'pickup' && !cleanPickupPointId) {
      console.error('❌ Pickup point ID required for pickup orders');
      return new Response(
        JSON.stringify({ error: 'pickup_point_id is required for pickup orders' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate delivery address for delivery orders
    if (checkoutData.fulfillment_type === 'delivery' && !checkoutData.delivery_address) {
      console.error('❌ Delivery address required for delivery orders');
      return new Response(
        JSON.stringify({ error: 'delivery_address is required for delivery orders' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log('🚀 Calling create_order_with_items function...');

    // Call the new production-grade create_order_with_items function
    const { data: orderId, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_id: customer_id,
        p_fulfillment_type: checkoutData.fulfillment_type,
        p_delivery_address: checkoutData.delivery_address || null,
        p_pickup_point_id: cleanPickupPointId,
        p_delivery_zone_id: cleanDeliveryZoneId,
        p_guest_session_id: cleanGuestSessionId,
        p_items: transformedItems
      });

    if (orderError) {
      console.error('❌ Error creating order:', orderError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create order', 
          details: orderError.message,
          hint: orderError.hint 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (!orderId) {
      console.error('❌ No order ID returned from database function');
      return new Response(
        JSON.stringify({ error: 'Failed to create order: No order ID returned' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Order created successfully: ${orderId}`);

    // Get the created order details for response
    const { data: orderDetails, error: fetchError } = await supabaseClient
      .from('orders')
      .select('order_number, total_amount')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.warn('⚠️ Could not fetch order details:', fetchError);
    }

    // Handle payment processing
    if (checkoutData.payment_method === 'paystack') {
      console.log('💳 Processing Paystack payment...');
      
      // Generate unique reference for payment transaction
      const paymentReference = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert payment transaction record
      const { data: paymentTransaction, error: paymentError } = await supabaseClient
        .from('payment_transactions')
        .insert({
          order_id: orderId,
          customer_email: checkoutData.customer_email,
          customer_name: checkoutData.customer_name,
          amount: orderDetails?.total_amount || checkoutData.total_amount || 0,
          currency: 'NGN',
          payment_method: 'paystack',
          status: 'pending',
          provider_reference: paymentReference,
          transaction_type: 'charge'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Error creating payment transaction:', paymentError);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment transaction' }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('💾 Payment transaction created:', paymentTransaction.id);

      // Use paystack-secure function to initialize payment
      const paymentAmount = orderDetails?.total_amount || checkoutData.total_amount || 0;
      
      if (!paymentAmount || paymentAmount <= 0) {
        console.error('❌ Invalid payment amount:', paymentAmount);
        return new Response(
          JSON.stringify({ error: 'Invalid payment amount' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: paystackData, error: paystackError } = await supabaseClient.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: checkoutData.customer_email,
          amount: Math.round(paymentAmount * 100), // Convert to kobo
          reference: paymentReference,
          channels: ['card', 'bank', 'ussd', 'mobile_money'],
          metadata: {
            order_id: orderId,
            order_number: orderDetails?.order_number,
            customer_name: checkoutData.customer_name,
            customer_email: checkoutData.customer_email,
            total_amount: paymentAmount
          }
        }
      });

      if (paystackError || !paystackData?.status) {
        console.error('❌ Paystack initialization failed:', paystackError || paystackData);
        return new Response(
          JSON.stringify({ 
            error: 'Payment initialization failed',
            details: paystackError?.message || paystackData?.error || 'Unknown payment gateway error'
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('✅ Paystack payment initialized');

      return new Response(
        JSON.stringify({
          success: true,
          order_id: orderId,
          order_number: orderDetails?.order_number,
          payment: {
            payment_url: paystackData.data.authorization_url,
            reference: paymentReference,
            message: 'Redirecting to payment gateway...'
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // For other payment methods, trigger order confirmation email
      await supabaseClient.functions.invoke('enhanced-email-processor', {
        body: {
          event_type: 'order_confirmation',
          recipient_email: checkoutData.customer_email,
          order_id: orderId,
          priority: 'high'
        }
      });
    }

    // Log checkout completion
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'checkout_completed_v2',
        category: 'Order Management',
        message: `Checkout completed for order ${orderId}`,
        new_values: {
          order_id: orderId,
          order_number: orderDetails?.order_number,
          customer_id,
          customer_email: checkoutData.customer_email,
          payment_method: checkoutData.payment_method,
          total_amount: orderDetails?.total_amount,
          is_new_customer: isNewCustomer,
          fulfillment_type: checkoutData.fulfillment_type
        }
      });

    // Trigger enhanced email processor for order created event
    await supabaseClient.functions.invoke('enhanced-email-processor', {
      body: {
        event_type: 'order_created',
        recipient_email: checkoutData.customer_email,
        order_id: orderId
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        order_number: orderDetails?.order_number,
        total_amount: orderDetails?.total_amount,
        message: 'Order created successfully'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('💥 Checkout processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
// supabase/functions/process-checkout/index.ts - Production-ready checkout function
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { toZonedTime, fromZonedTime } from "https://esm.sh/date-fns-tz@3.2.0"
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

// Lagos timezone constant
const LAGOS_TIMEZONE = 'Africa/Lagos';

/**
 * Convert Lagos local time to UTC for database storage
 * @param lagosDate - Date string in YYYY-MM-DD format
 * @param lagosTime - Time string in HH:mm format (Lagos local time)
 * @returns ISO string in UTC
 */
function lagosToUTC(lagosDate: string, lagosTime: string): string {
  // Create date-time string and parse
  const dateTimeStr = `${lagosDate}T${lagosTime}:00`;
  const parsedDate = new Date(dateTimeStr);
  
  // Convert from Lagos time to UTC
  const utcDate = fromZonedTime(parsedDate, LAGOS_TIMEZONE);
  
  return utcDate.toISOString();
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    console.log('🚀 Starting checkout process...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('📦 Checkout request:', JSON.stringify(body, null, 2))

    const {
      items = [],
      customer = {},
      fulfillment = {},
      delivery_schedule = {},
      payment = {},
      idempotency_key
    } = body

    // Input validation
    if (!items?.length) throw new Error('No items in cart')
    if (!customer?.email) throw new Error('Customer email is required')
    if (!customer?.name) throw new Error('Customer name is required')
    if (!customer?.phone) throw new Error('Customer phone is required')
    
    // 🔒 STEP 1: Email validation and domain checking
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(customer.email)) {
      throw new Error('Invalid email format')
    }
    
    // Block temp/local email domains for Paystack
    const emailLower = customer.email.toLowerCase()
    if (emailLower.includes('@temp.') || emailLower.includes('@local.') || emailLower.includes('.local')) {
      console.error('❌ Invalid email domain detected:', customer.email)
      throw new Error('Invalid email address. Please use a valid email address.')
    }
    
    // 🔒 Additional validation: Use authenticated user's email if available
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: { headers: { Authorization: authHeader } }
        }
      )
      
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      
      if (user && user.email) {
        // Override with authenticated user's email
        console.log('✅ Using authenticated user email:', user.email)
        customer.email = user.email
      }
    }
    
    console.log('📧 Email validation passed:', {
      email: customer.email,
      is_authenticated: !!authHeader,
      domain: customer.email.split('@')[1]
    })
    
    // Validate delivery/pickup time fields (CRITICAL for 1-hour window logic)
    if (fulfillment.type === 'delivery' && !delivery_schedule?.delivery_time_start) {
      throw new Error('Delivery time is required for delivery orders')
    }
    if (fulfillment.type === 'pickup' && !delivery_schedule?.delivery_time_start) {
      throw new Error('Pickup time is required for pickup orders')
    }
    if (!delivery_schedule?.delivery_date) {
      throw new Error('Delivery/pickup date is required')
    }

    // Calculate amounts (Paystack will add their own fees at checkout)
    const subtotal = items.reduce((sum: number, item: any) => 
      sum + ((item.unit_price || item.price) * item.quantity), 0)
    const deliveryFee = fulfillment?.type === 'delivery' ? (fulfillment.delivery_fee || 0) : 0
    const taxAmount = 0 // Add tax calculation if needed
    const totalAmount = subtotal + deliveryFee + taxAmount
    
    console.log('💰 Calculated totals (Paystack fees will be added):', { subtotal, deliveryFee, taxAmount, totalAmount })

    // Generate order number and payment reference
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substr(2, 9)
    const orderNumber = `ORD-${timestamp}-${randomId}`
    const paymentReference = `txn_${timestamp}_${randomId}`
    
    console.log('🏷️ Generated identifiers:', { orderNumber, paymentReference })

    // Start database transaction
    const orderId = crypto.randomUUID()
    const orderTime = new Date().toISOString()

    // Create order data matching actual schema
    const orderData = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      guest_session_id: customer.guest_session_id && customer.guest_session_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? customer.guest_session_id : null,
      order_type: fulfillment.type === 'pickup' ? 'pickup' : 'delivery',
      status: 'pending',
      payment_status: 'pending',
      subtotal: subtotal,
      tax_amount: taxAmount,
      delivery_fee: deliveryFee,
      transaction_fee: 0, // Paystack handles fees dynamically at checkout
      total_amount: totalAmount,
      payment_method: payment.method || 'paystack',
      payment_reference: paymentReference,
      paystack_reference: paymentReference,
      pickup_point_id: fulfillment.pickup_point_id && fulfillment.pickup_point_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? fulfillment.pickup_point_id : null,
      delivery_address: fulfillment.type === 'delivery' ? {
        address: fulfillment.address || '',
        location: fulfillment.location || '',
        zone_id: fulfillment.delivery_zone_id || null
      } : null,
      delivery_zone_id: fulfillment.delivery_zone_id || null,
      // CRITICAL: Convert Lagos local time to UTC for proper storage
      pickup_time: fulfillment.type === 'pickup' 
        ? lagosToUTC(delivery_schedule.delivery_date, delivery_schedule.delivery_time_start)
        : null,
      delivery_time: fulfillment.type === 'delivery' 
        ? lagosToUTC(delivery_schedule.delivery_date, delivery_schedule.delivery_time_start)
        : null,
      delivery_date: delivery_schedule.delivery_date || null,
      special_instructions: delivery_schedule.special_instructions || '',
      order_time: orderTime,
      created_at: orderTime,
      updated_at: orderTime
    }

    console.log('💾 Creating order with schema-aligned data')

    // Create order record
    const { data: orderResult, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single()

    if (orderError) {
      console.error('❌ Order creation error:', orderError)
      
      // Handle duplicate order attempts
      if (orderError.code === '23505' && idempotency_key) {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('*')
          .eq('payment_reference', paymentReference)
          .single()
        
        if (existingOrder) {
          console.log('♻️ Found existing order:', existingOrder.order_number)
          return new Response(JSON.stringify({
            success: true,
            order: existingOrder,
            payment: {
              authorization_url: `https://checkout.paystack.com/${existingOrder.paystack_reference}`,
              reference: existingOrder.payment_reference
            },
            message: 'Order already exists'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }
      }
      
      throw new Error(`Order creation failed: ${orderError.message}`)
    }

    console.log('✅ Order created successfully:', orderResult.order_number)

    // Create order items
    console.log('📝 Creating order items...')
    const orderItemsData = items.map((item: any, index: number) => ({
      id: crypto.randomUUID(),
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      unit_price: item.unit_price || item.price,
      total_price: (item.unit_price || item.price) * item.quantity,
      customizations: item.customizations || null,
      special_instructions: item.special_instructions || null,
      created_at: orderTime,
      updated_at: orderTime
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      console.error('❌ Order items creation error:', itemsError)
      // Cleanup: Delete the order if items creation fails
      await supabase.from('orders').delete().eq('id', orderId)
      throw new Error(`Order items creation failed: ${itemsError.message}`)
    }

    console.log('✅ Order items created successfully')

    // Initialize Paystack payment
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('Paystack secret key not configured')
    }

    const paystackPayload = {
      email: customer.email,
      amount: totalAmount * 100, // Convert to kobo
      reference: paymentReference,
      callback_url: `https://startersmallchops.com/payment/callback?trxref=${paymentReference}&reference=${paymentReference}`,
      metadata: {
        order_id: orderId,
        order_number: orderNumber,
        customer_name: customer.name,
        items_count: items.length
      }
    }

    console.log('💳 Initializing Paystack payment:', {
      reference: paystackPayload.reference,
      amount: paystackPayload.amount,
      email: paystackPayload.email
    })

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackPayload)
    })

    const paystackData = await paystackResponse.json()
    console.log('💳 Paystack response:', paystackResponse.ok ? '✅' : '❌', paystackData.status)

    if (!paystackResponse.ok || !paystackData.status) {
      throw new Error(`Paystack error: ${paystackData.message || 'Payment initialization failed'}`)
    }

    console.log('✅ Checkout process completed successfully')

    return new Response(JSON.stringify({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        payment_reference: paymentReference,
        total_amount: totalAmount,
        status: 'pending',
        items_count: items.length
      },
      payment: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paymentReference
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('❌ Checkout process failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Checkout failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})
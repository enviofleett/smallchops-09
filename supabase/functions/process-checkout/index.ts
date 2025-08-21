
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CheckoutRequest {
  customer: {
    id?: string
    name: string
    email: string
    phone?: string
  }
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    customizations?: any
  }>
  fulfillment: {
    type: 'delivery' | 'pickup'
    address?: any
    pickup_point_id?: string
    delivery_zone_id?: string
    scheduled_time?: string
  }
  payment?: {
    method?: string
  }
  guest_session_id?: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🛒 Processing checkout request...')
    
    const requestBody: CheckoutRequest = await req.json()
    console.log('📨 Checkout request received:', {
      customer_email: requestBody.customer?.email,
      items_count: requestBody.items?.length,
      fulfillment_type: requestBody.fulfillment?.type,
      has_guest_session: !!requestBody.guest_session_id
    })

    // CRITICAL FIX: Force guest_session_id to NULL (guest mode discontinued)
    const processedRequest = {
      ...requestBody,
      guest_session_id: null // Always null - guest mode discontinued
    }

    console.log('🚫 Guest mode disabled - forcing guest_session_id to null')

    // Validate request
    if (!processedRequest.customer?.email) {
      throw new Error('Customer email is required')
    }

    if (!processedRequest.items || processedRequest.items.length === 0) {
      throw new Error('Order must contain at least one item')
    }

    if (!processedRequest.fulfillment?.type) {
      throw new Error('Fulfillment type is required')
    }

    // Create or get customer account
    let customerId: string

    if (processedRequest.customer.id) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(processedRequest.customer.id)) {
        throw new Error('Invalid customer ID format')
      }
      customerId = processedRequest.customer.id
      console.log('👤 Using existing customer:', customerId)
    } else {
      // Create new customer account
      const { data: newCustomer, error: customerError } = await supabaseAdmin
        .from('customer_accounts')
        .insert({
          name: processedRequest.customer.name,
          email: processedRequest.customer.email.toLowerCase(),
          phone: processedRequest.customer.phone,
          email_verified: false,
          phone_verified: false,
          profile_completion_percentage: 60
        })
        .select('id')
        .single()

      if (customerError) {
        console.error('❌ Customer creation failed:', customerError)
        throw new Error('Failed to create customer account')
      }

      customerId = newCustomer.id
      console.log('👤 Created new customer:', customerId)
    }

    console.log('📝 Creating order with items...')

    // Prepare items for order creation
    const orderItems = processedRequest.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customizations: item.customizations
    }))

    // Create order using the database function
    const { data: orderId, error: orderError } = await supabaseAdmin
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: processedRequest.fulfillment.type,
        p_delivery_address: processedRequest.fulfillment.address || null,
        p_pickup_point_id: processedRequest.fulfillment.pickup_point_id || null,
        p_delivery_zone_id: processedRequest.fulfillment.delivery_zone_id || null,
        p_guest_session_id: null, // Always null
        p_items: orderItems
      })

    if (orderError) {
      console.error('❌ Order creation failed:', orderError)
      throw new Error(`Order creation failed: ${orderError.message}`)
    }

    console.log('✅ Order created successfully:', orderId)

    // Get the created order details
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, customer_email')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      throw new Error('Failed to fetch created order')
    }

    console.log('💰 Order details:', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      customer_email: order.customer_email
    })

    // Initialize payment using paystack-secure
    console.log('💳 Initializing payment via paystack-secure...')
    
    const { data: paymentData, error: paymentError } = await supabaseAdmin.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: order.customer_email,
        amount: order.total_amount,
        metadata: {
          order_id: order.id,
          customer_name: processedRequest.customer.name,
          order_number: order.order_number,
          fulfillment_type: processedRequest.fulfillment.type,
          items_subtotal: order.total_amount,
          delivery_fee: 0,
          client_total: order.total_amount,
          authoritative_total: order.total_amount
        },
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?reference=__REFERENCE__&order_id=${order.id}`
      }
    })

    if (paymentError) {
      console.error('❌ Payment initialization failed:', paymentError)
      throw new Error(`Payment initialization failed: ${paymentError.message}`)
    }

    console.log('✅ Payment initialized successfully via paystack-secure')

    // Return success response
    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        status: 'pending'
      },
      customer: {
        id: customerId,
        email: order.customer_email
      },
      payment: {
        authorization_url: paymentData.data?.authorization_url || paymentData.authorization_url,
        reference: paymentData.data?.reference || paymentData.reference
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Checkout processing error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Checkout processing failed',
      details: {
        timestamp: new Date().toISOString(),
        error_type: error.constructor.name
      }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

/*
🛒 PRODUCTION CHECKOUT PROCESSOR
✅ Guest mode completely disabled (guest_session_id always null)
✅ Robust UUID validation for customer IDs
✅ Uses paystack-secure for all payment initialization
✅ Comprehensive error handling and logging
✅ Idempotent order creation with database function
✅ Production-ready error responses

🔧 USAGE:
POST /functions/v1/process-checkout
{
  "customer": {
    "id": "uuid-optional",
    "name": "Customer Name",
    "email": "customer@email.com",
    "phone": "+234..."
  },
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Product Name",
      "quantity": 2,
      "unit_price": 1000
    }
  ],
  "fulfillment": {
    "type": "delivery",
    "address": {...}
  }
}

📊 RESPONSE:
{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": "ORD-...",
    "total_amount": 2000,
    "status": "pending"
  },
  "payment": {
    "authorization_url": "https://checkout.paystack.com/...",
    "reference": "txn_..."
  }
}
*/

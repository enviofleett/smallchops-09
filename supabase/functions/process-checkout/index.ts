import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get request body
    const requestBody = await req.json()
    console.log('📥 Received checkout request:', JSON.stringify(requestBody, null, 2))

    // Extract data from request
    const {
      customer_email,
      customer_name,
      customer_phone,
      guest_session_id,
      fulfillment_type,
      delivery_address,
      pickup_point_id,
      delivery_zone_id,
      order_items,
      total_amount,
      delivery_fee,
      payment_method = 'paystack'
    } = requestBody

    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    let user = null
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: authUser }, error } = await supabase.auth.getUser(token)
        if (!error && authUser) {
          user = authUser
          console.log('✅ Authenticated user found:', user.id)
        }
      } catch (authError) {
        console.log('⚠️ Auth validation failed, treating as guest:', authError.message)
      }
    }

    // Determine if this is a guest checkout
    const isGuestCheckout = !user && guest_session_id
    console.log('👤 User context analysis:', {
      hasUser: !!user,
      userId: user?.id,
      isGuest: isGuestCheckout,
      guestSessionId: guest_session_id
    })

    // 🔧 CRITICAL: Initialize customer_id properly
    let customer_id = null

    if (!isGuestCheckout && user) {
      console.log('🔍 Processing authenticated user checkout...')
      
      // Try to find or create customer account for authenticated users
      try {
        // First check if customer account already exists
        const { data: existingCustomer, error: lookupError } = await supabase
          .from('customer_accounts')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (existingCustomer) {
          customer_id = existingCustomer.id
          console.log('✅ Found existing customer account:', customer_id)
        } else {
          console.log('🔧 Creating new customer account...')
          
          // Create new customer account
          const { data: newCustomer, error: createError } = await supabase
            .from('customer_accounts')
            .insert({
              user_id: user.id,
              name: customer_name,
              email: customer_email,
              phone: customer_phone
            })
            .select('id')
            .single()

          if (createError) {
            console.error('❌ Failed to create customer account:', createError)
            // Continue as guest-like checkout
            customer_id = null
          } else {
            customer_id = newCustomer.id
            console.log('✅ Created new customer account:', customer_id)
          }
        }
      } catch (customerError) {
        console.error('❌ Customer account handling error:', customerError)
        customer_id = null
      }
    } else {
      console.log('👤 Processing guest checkout, skipping customer account creation')
      customer_id = null
    }

    // Generate unique order number
    const orderNumber = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random() * 10000)}`
    
    // Calculate subtotal from order items
    let subtotal = 0
    const itemsWithPrices = await Promise.all(
      order_items.map(async (item: any) => {
        let unitPrice = item.unit_price || item.price || 0
        
        // Fetch price from database if not provided
        if (unitPrice <= 0) {
          try {
            const { data: product } = await supabase
              .from('products')
              .select('price, name')
              .eq('id', item.product_id)
              .single()
            
            if (product) {
              unitPrice = product.price
              console.log(`✅ Fetched price for ${product.name}: ${unitPrice}`)
            }
          } catch (error) {
            console.error(`❌ Failed to fetch price for item ${item.product_id}:`, error)
          }
        }
        
        const itemTotal = unitPrice * item.quantity
        subtotal += itemTotal
        
        return {
          ...item,
          unit_price: unitPrice,
          total_price: itemTotal
        }
      })
    )

    // Calculate tax and total
    const taxAmount = subtotal * 0.075 // 7.5% VAT
    const deliveryFeeAmount = delivery_fee || 0
    const calculatedTotal = subtotal + taxAmount + deliveryFeeAmount
    
    // Use provided total or calculated total
    const finalTotal = total_amount || calculatedTotal

    // Prepare order data with proper column mapping
    const orderData = {
      customer_id: customer_id, // ✅ Properly initialized
      customer_email: customer_email,
      customer_name: customer_name,
      customer_phone: customer_phone,
      guest_session_id: isGuestCheckout ? guest_session_id : null,
      order_number: orderNumber,
      order_type: fulfillment_type, // Map fulfillment_type to order_type
      delivery_address: delivery_address,
      pickup_point_id: pickup_point_id,
      delivery_zone_id: delivery_zone_id,
      subtotal: subtotal,
      tax_amount: taxAmount,
      delivery_fee: deliveryFeeAmount,
      total_amount: finalTotal,
      payment_method: payment_method,
      payment_status: 'pending',
      status: 'pending',
      order_time: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('📦 Creating order with data:', {
      customer_id: orderData.customer_id,
      customer_email: orderData.customer_email,
      order_number: orderData.order_number,
      total_amount: orderData.total_amount,
      isGuest: isGuestCheckout
    })

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select('*')
      .single()

    if (orderError) {
      console.error('❌ Order creation failed:', orderError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to create order',
          details: orderError.message
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Order created successfully:', order.id)

    // Insert order items into separate table
    const orderItemsData = itemsWithPrices.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
      discount_amount: item.discount_amount || 0
    }))

    // Get product names for order items
    const productIds = orderItemsData.map(item => item.product_id)
    const { data: products } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds)

    const productNameMap = products?.reduce((acc: any, product: any) => {
      acc[product.id] = product.name
      return acc
    }, {}) || {}

    // Add product names to order items
    const orderItemsWithNames = orderItemsData.map(item => ({
      ...item,
      product_name: productNameMap[item.product_id] || 'Unknown Product'
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithNames)

    if (itemsError) {
      console.error('⚠️ Failed to insert order items:', itemsError)
      // Continue with order creation even if items fail
    } else {
      console.log('✅ Order items inserted successfully')
    }

    // Initialize Paystack payment
    const paymentReference = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Get Paystack configuration
    const { data: paystackConfig } = await supabase.rpc('get_active_paystack_config')
    
    if (!paystackConfig || paystackConfig.length === 0) {
      console.error('❌ Paystack configuration not found')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment gateway not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const config = paystackConfig[0]
    
    // Initialize Paystack payment via edge function
    try {
      const paymentResponse = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: customer_email,
          amount: Math.round(finalTotal * 100), // Convert to kobo
          reference: paymentReference,
          metadata: {
            order_id: order.id,
            customer_name: customer_name,
            order_number: order.order_number
          }
        }
      })

      if (paymentResponse.error) {
        console.error('❌ Paystack initialization failed:', paymentResponse.error)
        throw new Error('Payment initialization failed')
      }

      // Update order with payment reference
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_reference: paymentReference })
        .eq('id', order.id)

      if (updateError) {
        console.error('⚠️ Failed to update payment reference:', updateError)
      }

      // Return success response with payment URL
      const response = {
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        payment: {
          payment_url: paymentResponse.data.authorization_url,
          reference: paymentReference,
          access_code: paymentResponse.data.access_code
        },
        message: "Order created and payment initialized successfully"
      }

      console.log('🎉 Checkout successful:', response)

      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
      
    } catch (paymentError) {
      console.error('❌ Payment initialization error:', paymentError)
      
      // Return order created but payment failed
      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          payment: {
            payment_url: null,
            reference: paymentReference,
            error: 'Payment initialization failed - please contact support'
          },
          message: "Order created but payment initialization failed"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

  } catch (error) {
    console.error('💥 Edge Function error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
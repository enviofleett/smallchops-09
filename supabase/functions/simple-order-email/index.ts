import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderEmailRequest {
  orderId: string
  status: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { orderId, status }: OrderEmailRequest = await req.json()

    console.log(`📧 Processing email for order ${orderId} with status ${status}`)

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('order_number, customer_name, customer_email')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      throw new Error('Order not found')
    }

    if (!order.customer_email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No customer email available'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Call simple SMTP sender
    const emailResponse = await supabase.functions.invoke('simple-smtp-sender', {
      body: {
        to: order.customer_email,
        customerName: order.customer_name || 'Customer',
        orderNumber: order.order_number,
        status: status
      }
    })

    if (emailResponse.error) {
      throw new Error(emailResponse.error.message || 'Email sending failed')
    }

    console.log(`✅ Email processed successfully for order ${order.order_number}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully',
        orderNumber: order.order_number,
        recipient: order.customer_email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('❌ Order email processing failed:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to process order email'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
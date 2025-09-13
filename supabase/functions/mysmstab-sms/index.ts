import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMSRequest {
  phoneNumber: string
  message: string
  sender?: string
}

interface MySMSTabResponse {
  status: string
  message: string
  data?: {
    reference?: string
    messageId?: string
    cost?: number
    balance?: number
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { phoneNumber, message, sender = 'MySMSTab' } = await req.json() as SMSRequest

    // Get MySMSTab API credentials
    const { data: providerSettings } = await supabaseClient
      .from('sms_provider_settings')
      .select('api_key, api_secret, base_url, sender_id')
      .eq('provider_name', 'MySMSTab')
      .eq('is_active', true)
      .single()

    if (!providerSettings) {
      throw new Error('MySMSTab provider not configured')
    }

    // Prepare MySMSTab API request
    const smsPayload = {
      message: message,
      recipients: phoneNumber,
      sender: providerSettings.sender_id || sender,
      route: 'dnd', // Direct route
    }

    console.log('Sending SMS via MySMSTab:', { phoneNumber, sender: smsPayload.sender })

    // Send SMS via MySMSTab API
    const response = await fetch(`${providerSettings.base_url}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerSettings.api_key}`,
      },
      body: JSON.stringify(smsPayload)
    })

    const responseData = await response.json() as MySMSTabResponse

    console.log('MySMSTab API response:', responseData)

    // Update wallet balance if provided
    if (responseData.data?.balance) {
      await supabaseClient.rpc('update_sms_wallet_balance', {
        new_balance: responseData.data.balance,
        provider: 'MySMSTab'
      })
    }

    // Log SMS delivery attempt
    const deliveryStatus = response.ok && responseData.status === 'success' ? 'sent' : 'failed'
    const errorMessage = !response.ok ? responseData.message : null

    await supabaseClient.rpc('log_sms_delivery', {
      p_communication_event_id: null, // Will be updated by caller if needed
      p_recipient_phone: phoneNumber,
      p_message_content: message,
      p_sender: smsPayload.sender,
      p_status: deliveryStatus,
      p_provider_response: responseData,
      p_cost: responseData.data?.cost || null,
      p_error_code: response.ok ? null : response.status.toString(),
      p_error_message: errorMessage
    })

    if (!response.ok || responseData.status !== 'success') {
      throw new Error(`SMS delivery failed: ${responseData.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS sent successfully',
        data: {
          messageId: responseData.data?.messageId,
          cost: responseData.data?.cost,
          balance: responseData.data?.balance
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('SMS sending error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
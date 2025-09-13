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
  checkBalance?: boolean
}

interface MySMSTabResponse {
  status: string
  message: string
  data?: {
    reference?: string
    messageId?: string
    cost?: number
    balance?: number
    sms_count?: number
  }
}

interface MySMSTabBalanceResponse {
  status: string
  message: string
  data?: {
    balance?: number
    currency?: string
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

    const { phoneNumber, message, sender, checkBalance = false } = await req.json() as SMSRequest

    // Get MySMSTab API credentials
    const { data: providerSettings, error: providerError } = await supabaseClient
      .from('sms_provider_settings')
      .select('api_username, api_password, api_url, default_sender')
      .eq('provider_name', 'MySMSTab')
      .eq('is_active', true)
      .single()

    if (providerError || !providerSettings) {
      console.error('Provider settings error:', providerError)
      throw new Error('MySMSTab provider not configured or inactive')
    }

    if (!providerSettings.api_username || !providerSettings.api_password) {
      throw new Error('MySMSTab API credentials not configured')
    }

    // Handle balance check request
    if (checkBalance) {
      console.log('Checking MySMSTab balance...')
      
      const balanceResponse = await fetch(`${providerSettings.api_url}balance/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: providerSettings.api_username,
          password: providerSettings.api_password
        })
      })

      const balanceData = await balanceResponse.json() as MySMSTabBalanceResponse
      console.log('MySMSTab balance response:', balanceData)

      if (balanceData.data?.balance) {
        await supabaseClient.rpc('update_sms_wallet_balance', {
          new_balance: balanceData.data.balance,
          provider: 'MySMSTab'
        })
      }

      return new Response(
        JSON.stringify({
          success: balanceResponse.ok && balanceData.status === 'success',
          message: balanceData.message || 'Balance check completed',
          data: {
            balance: balanceData.data?.balance,
            currency: balanceData.data?.currency || 'NGN'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: balanceResponse.ok ? 200 : 400,
        }
      )
    }

    // Validate required fields for SMS sending
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required')
    }

    // Prepare MySMSTab SMS API request
    const smsPayload = {
      username: providerSettings.api_username,
      password: providerSettings.api_password,
      message: message,
      recipients: phoneNumber,
      sender: sender || providerSettings.default_sender || 'MySMSTab',
      route: 'dnd', // Direct route for delivery
      type: 'plain'
    }

    console.log('Sending SMS via MySMSTab:', { 
      phoneNumber, 
      sender: smsPayload.sender,
      api_url: providerSettings.api_url 
    })

    // Send SMS via MySMSTab API
    const response = await fetch(`${providerSettings.api_url}sendsms/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    const errorMessage = !response.ok || responseData.status !== 'success' ? responseData.message : null

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
          messageId: responseData.data?.messageId || responseData.data?.reference,
          cost: responseData.data?.cost,
          balance: responseData.data?.balance,
          sms_count: responseData.data?.sms_count
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('MySMSTab SMS operation error:', error)
    
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
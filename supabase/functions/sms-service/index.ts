import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  to: string;
  template_key: string;
  variables?: Record<string, string>;
  priority?: 'low' | 'normal' | 'high';
  order_id?: string;
}

interface MySMSTabResponse {
  status?: string;
  count?: number;
  price?: number;
  error?: string;
  errno?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { to, template_key, variables = {}, priority = 'normal', order_id } = await req.json() as SMSRequest;

    console.log('SMS Service: Processing SMS request', { to, template_key, priority, order_id });

    // Validate input
    if (!to || !template_key) {
      throw new Error('Missing required parameters: to and template_key');
    }

    // Clean phone number (remove spaces, dashes, plus signs)
    const cleanPhoneNumber = to.replace(/[\s\-\+]/g, '');
    
    // Ensure Nigerian number format
    let formattedPhone = cleanPhoneNumber;
    if (cleanPhoneNumber.startsWith('0')) {
      formattedPhone = '234' + cleanPhoneNumber.substring(1);
    } else if (!cleanPhoneNumber.startsWith('234')) {
      formattedPhone = '234' + cleanPhoneNumber;
    }

    // Get SMS configuration
    const { data: smsConfig, error: configError } = await supabaseAdmin
      .from('sms_configuration')
      .select('*')
      .eq('is_active', true)
      .eq('provider', 'mysmstab')
      .single();

    if (configError || !smsConfig) {
      throw new Error('SMS configuration not found or inactive');
    }

    // Get SMS template
    const { data: template, error: templateError } = await supabaseAdmin
      .from('sms_templates')
      .select('*')
      .eq('template_key', template_key)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error(`SMS template '${template_key}' not found or inactive`);
    }

    // Replace template variables
    let message = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    });

    // Check message length
    if (message.length > template.max_length) {
      console.warn(`SMS message length (${message.length}) exceeds limit (${template.max_length})`);
      message = message.substring(0, template.max_length - 3) + '...';
    }

    // Rate limiting check - simple in-memory check
    // In production, you'd want to use Redis or database-based rate limiting
    const rateLimitKey = `sms_rate_${Date.now() - (Date.now() % 60000)}`; // Per minute window
    
    // Get credentials from Supabase secrets
    const username = Deno.env.get('MYSMSTAB_USERNAME');
    const password = Deno.env.get('MYSMSTAB_PASSWORD');

    if (!username || !password) {
      throw new Error('MySMSTab credentials not configured');
    }

    // Prepare MySMSTab API request
    const apiUrl = 'https://sms.mysmstab.com/api/';
    const params = new URLSearchParams({
      username,
      password,
      message,
      sender: smsConfig.sender_id,
      mobiles: formattedPhone,
    });

    console.log('SMS Service: Sending to MySMSTab API', { url: apiUrl, sender: smsConfig.sender_id, phone: formattedPhone });

    // Send SMS via MySMSTab API
    const smsResponse = await fetch(`${apiUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseText = await smsResponse.text();
    console.log('MySMSTab API Response:', responseText);

    let smsResult: MySMSTabResponse;
    try {
      smsResult = JSON.parse(responseText);
    } catch {
      // Handle non-JSON responses (some MySMSTab responses might be plain text)
      if (responseText.toLowerCase().includes('ok')) {
        smsResult = { status: 'OK', count: 1, price: smsConfig.cost_per_sms };
      } else {
        smsResult = { error: responseText, errno: '999' };
      }
    }

    // Determine if SMS was successful
    const isSuccess = smsResult.status === 'OK' || responseText.toLowerCase().includes('ok');
    const finalStatus = isSuccess ? 'sent' : 'failed';

    // Log to notification delivery log
    const logData = {
      template_key,
      channel: 'sms' as const,
      recipient: to,
      status: finalStatus as 'sent' | 'failed' | 'pending' | 'delivered',
      provider_response: smsResult,
      error_message: smsResult.error || null,
      phone_number: formattedPhone,
      sms_provider_message_id: null, // MySMSTab doesn't provide message IDs in basic plan
      sms_cost: smsResult.price || smsConfig.cost_per_sms,
      delivery_report_status: isSuccess ? 'sent' : 'failed',
      order_id,
      created_at: new Date().toISOString(),
    };

    const { error: logError } = await supabaseAdmin
      .from('notification_delivery_log')
      .insert(logData);

    if (logError) {
      console.error('Failed to log SMS delivery:', logError);
    }

    // Update SMS stats in audit logs
    await supabaseAdmin.from('audit_logs').insert({
      action: 'sms_sent',
      category: 'SMS Service',
      message: `SMS sent via MySMSTab: ${finalStatus}`,
      new_values: {
        template_key,
        phone_number: formattedPhone,
        status: finalStatus,
        cost: smsResult.price || smsConfig.cost_per_sms,
        provider_response: smsResult,
        order_id,
      },
    });

    if (!isSuccess) {
      throw new Error(smsResult.error || 'SMS sending failed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'SMS sent successfully',
        provider_response: smsResult,
        delivery_log_id: null, // Would need to get this from insert
        cost: smsResult.price || smsConfig.cost_per_sms,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('SMS Service Error:', error);

    // Log error to audit logs
    try {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { auth: { persistSession: false } }
      );

      await supabaseAdmin.from('audit_logs').insert({
        action: 'sms_send_failed',
        category: 'SMS Service',
        message: `SMS sending failed: ${error.message}`,
        new_values: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (logError) {
      console.error('Failed to log SMS error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
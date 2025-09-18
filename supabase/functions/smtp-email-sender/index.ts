import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SMTP Compatibility Wrapper - Proxies to unified-smtp-sender
// This maintains backward compatibility for legacy email sending calls

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  console.log(`🔄 SMTP Compatibility Wrapper - ${req.method} request received`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle health check
    if (req.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        message: 'SMTP Compatibility Wrapper is operational',
        proxies_to: 'unified-smtp-sender',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    let requestBody;
    try {
      const bodyText = await req.text();
      requestBody = JSON.parse(bodyText);
      console.log('📥 Legacy SMTP request received:', {
        hasTo: !!requestBody.to,
        hasSubject: !!requestBody.subject,
        hasHtml: !!requestBody.html,
        hasText: !!requestBody.text
      });
    } catch (error) {
      console.error('❌ Failed to parse request body:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Transform legacy format to unified format
    const unifiedPayload = {
      to: requestBody.to,
      subject: requestBody.subject,
      emailType: 'transactional',
      
      // Handle content formats
      ...(requestBody.html && { htmlContent: requestBody.html }),
      ...(requestBody.text && { textContent: requestBody.text }),
      ...(requestBody.body && { textContent: requestBody.body }),
      
      // Pass through optional fields
      ...(requestBody.order_id && { orderId: requestBody.order_id }),
      ...(requestBody.variables && { variables: requestBody.variables }),
      ...(requestBody.templateId && { templateKey: requestBody.templateId }),
      
      // Metadata
      legacy_compat: true,
      source: 'smtp-email-sender-wrapper'
    };

    console.log('🚀 Proxying to unified-smtp-sender with payload:', {
      to: unifiedPayload.to,
      subject: unifiedPayload.subject,
      hasHtml: !!unifiedPayload.htmlContent,
      hasText: !!unifiedPayload.textContent,
      templateKey: unifiedPayload.templateKey
    });

    // Invoke unified-smtp-sender
    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: unifiedPayload,
      headers: {
        'Authorization': req.headers.get('Authorization') || `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      }
    });

    if (error) {
      console.error('❌ Unified SMTP sender error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email via unified sender'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Email sent successfully via unified sender');
    
    // Return response in legacy format
    return new Response(JSON.stringify({
      success: true,
      message: data.message || 'Email sent successfully',
      provider: data.provider + ' (via unified-smtp-sender)',
      messageId: data.messageId,
      legacy_compat: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 SMTP compatibility wrapper error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: `Compatibility wrapper failed: ${error.message}`,
      legacy_compat: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
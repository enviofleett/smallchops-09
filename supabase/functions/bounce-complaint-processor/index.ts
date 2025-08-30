import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BounceEvent {
  type: 'bounce' | 'complaint' | 'delivery' | 'click' | 'open';
  email: string;
  timestamp: string;
  reason?: string;
  bounceType?: 'hard' | 'soft';
  messageId?: string;
  provider?: string;
  metadata?: Record<string, any>;
}

async function processBounceEvent(supabase: any, event: BounceEvent) {
  console.log(`📨 Processing ${event.type} event for ${event.email}`);
  
  try {
    const domain = event.email.split('@')[1];
    
    // Determine bounce/complaint type
    let bounceType: string;
    let suppressionReason: string;
    
    if (event.type === 'bounce') {
      bounceType = event.bounceType || 'hard';
      suppressionReason = `${bounceType}_bounce`;
    } else if (event.type === 'complaint') {
      bounceType = 'complaint';
      suppressionReason = 'spam_complaint';
    } else {
      // Handle delivery confirmations and engagement
      await supabase.from('smtp_delivery_confirmations').insert({
        email_id: event.messageId || `unknown-${Date.now()}`,
        recipient_email: event.email,
        provider_used: event.provider || 'unknown',
        delivery_status: event.type === 'delivery' ? 'delivered' : event.type,
        provider_response: event.metadata || {}
      });
      
      return { success: true, action: 'logged_engagement' };
    }
    
    // Use the new auto-suppression function
    const { data: suppressionResult, error: suppressError } = await supabase
      .rpc('auto_suppress_bounced_email', {
        p_email: event.email,
        p_bounce_type: bounceType,
        p_reason: event.reason
      });

    if (suppressError) {
      console.warn('Auto-suppression function failed:', suppressError.message);
      // Fallback to manual suppression logic
      if (bounceType === 'hard' || bounceType === 'complaint') {
        await supabase
          .from('email_suppression_list')
          .upsert({
            email: event.email.toLowerCase(),
            suppression_type: bounceType,
            reason: `Fallback suppression: ${event.reason}`,
            is_active: true,
            suppressed_at: new Date().toISOString()
          });
      }
    } else {
      console.log(`📊 Auto-suppression result for ${event.email}: ${suppressionResult ? 'SUPPRESSED' : 'TRACKED'}`);
    }
    
    // Update communication events if we can find the related event
    if (event.messageId) {
      await supabase
        .from('communication_events')
        .update({
          delivery_status: event.type,
          status: event.type === 'bounce' || event.type === 'complaint' ? 'failed' : 'delivered',
          error_message: event.reason,
          updated_at: new Date().toISOString()
        })
        .eq('external_id', event.messageId);
    }
    
    // Calculate and update domain reputation
    await supabase.rpc('calculate_sender_reputation', {
      p_domain: domain
    });
    
    // Record health metric for the provider
    if (event.provider) {
      const metricType = event.type === 'bounce' ? 'bounce_rate' : 'complaint_rate';
      await supabase.rpc('record_smtp_health_metric', {
        p_provider_name: event.provider,
        p_metric_type: metricType,
        p_metric_value: 1, // Increment
        p_threshold_value: metricType === 'bounce_rate' ? 5 : 0.1
      });
    }
    
    return {
      success: true,
      action: shouldSuppress ? 'suppressed' : 'recorded',
      bounceType,
      suppressed: shouldSuppress,
      reason: autoSuppressionReason || event.reason
    };
    
  } catch (error) {
    console.error(`❌ Error processing ${event.type} event:`, error);
    throw error;
  }
}

async function processBulkEvents(supabase: any, events: BounceEvent[]) {
  console.log(`📦 Processing ${events.length} bulk events`);
  
  const results = [];
  const errors = [];
  
  for (const event of events) {
    try {
      const result = await processBounceEvent(supabase, event);
      results.push({ email: event.email, ...result });
    } catch (error) {
      errors.push({ 
        email: event.email, 
        error: error.message,
        type: event.type 
      });
    }
  }
  
  // Generate summary statistics
  const summary = {
    totalProcessed: events.length,
    successful: results.length,
    errors: errors.length,
    suppressed: results.filter(r => r.suppressed).length,
    bounces: results.filter(r => r.bounceType && r.bounceType !== 'complaint').length,
    complaints: results.filter(r => r.bounceType === 'complaint').length
  };
  
  console.log(`📊 Bulk processing summary:`, summary);
  
  return {
    success: true,
    summary,
    results,
    errors
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    
    // Handle both single events and bulk events
    if (Array.isArray(requestBody)) {
      // Bulk event processing
      const result = await processBulkEvents(supabase, requestBody);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    } else {
      // Single event processing
      const event: BounceEvent = requestBody;
      
      // Validate required fields
      if (!event.email || !event.type) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Missing required fields: email and type'
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Set default timestamp if not provided
      if (!event.timestamp) {
        event.timestamp = new Date().toISOString();
      }
      
      const result = await processBounceEvent(supabase, event);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Bounce/Complaint processor error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
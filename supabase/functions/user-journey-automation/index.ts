import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserJourneyEvent {
  journey_type: 'registration' | 'order_placement' | 'order_status_change' | 'password_reset';
  user_data: {
    email: string;
    name?: string;
    user_id?: string;
  };
  order_data?: {
    order_id: string;
    order_number: string;
    total_amount: number;
    items: any[];
    status?: string;
  };
  metadata?: Record<string, any>;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify internal authentication for server-to-server calls
    const internalSecret = req.headers.get('x-internal-secret')
    const timestamp = req.headers.get('x-timestamp')
    
    if (internalSecret && timestamp) {
      console.log('🔐 Verifying internal authentication...')
      
      const secret = Deno.env.get('UJ_INTERNAL_SECRET') || 'fallback-secret-key'
      const message = `${timestamp}:user-journey-automation`
      
      // Verify timestamp is recent (within 5 minutes)
      const currentTime = Math.floor(Date.now() / 1000)
      const requestTime = parseInt(timestamp)
      if (Math.abs(currentTime - requestTime) > 300) {
        console.error('❌ Request timestamp too old or invalid')
        return new Response(
          JSON.stringify({ error: 'Request timestamp invalid' }), 
          { status: 401, headers: corsHeaders }
        )
      }
      
      // Verify HMAC signature
      const encoder = new TextEncoder()
      const keyData = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      const signature = await crypto.subtle.sign('HMAC', keyData, encoder.encode(message))
      const signatureHex = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
      
      if (signatureHex !== internalSecret) {
        console.error('❌ Invalid HMAC signature')
        return new Response(
          JSON.stringify({ error: 'Invalid authentication signature' }), 
          { status: 401, headers: corsHeaders }
        )
      }
      
      console.log('✅ Internal authentication verified')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json()
    const { journey_type, user_data, order_data, metadata }: UserJourneyEvent = requestBody;

    console.log(`Processing user journey: ${journey_type} for ${user_data.email}`);

    let emailEvents: any[] = [];

    switch (journey_type) {
      case 'registration':
        emailEvents = await handleRegistrationJourney(supabase, user_data, metadata);
        break;
      
      case 'order_placement':
        emailEvents = await handleOrderPlacementJourney(supabase, user_data, order_data!, metadata);
        break;
      
      case 'order_status_change':
        emailEvents = await handleOrderStatusChangeJourney(supabase, user_data, order_data!, metadata);
        break;
      
      case 'password_reset':
        emailEvents = await handlePasswordResetJourney(supabase, user_data, metadata);
        break;
      
      default:
        throw new Error(`Unknown journey type: ${journey_type}`);
    }

    // Log the automation event
    await supabase
      .from('audit_logs')
      .insert({
        action: 'user_journey_automated',
        category: 'Email Automation',
        message: `Automated ${journey_type} journey for ${user_data.email}`,
        new_values: {
          journey_type,
          email_events_created: emailEvents.length,
          user_email: user_data.email,
          order_id: order_data?.order_id
        }
      });

    // Trigger immediate email processing for high-priority events
    if (['order_placement', 'order_status_change', 'password_reset'].includes(journey_type)) {
      try {
        await supabase.functions.invoke('instant-email-processor');
      } catch (processError) {
        console.warn('Failed to trigger immediate processing:', processError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        journey_type,
        email_events_created: emailEvents.length,
        events: emailEvents
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('User journey automation error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        journey_type: req.body?.journey_type 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});

async function handleRegistrationJourney(
  supabase: any, 
  userData: { email: string; name?: string; user_id?: string }, 
  metadata?: Record<string, any>
): Promise<any[]> {
  const events = [];

  // Welcome email
  const welcomeEvent = await supabase
    .from('communication_events')
    .insert({
      event_type: 'customer_welcome',
      recipient_email: userData.email,
      status: 'queued',
      template_key: 'customer_welcome',
      template_variables: {
        customer_name: userData.name || 'New Customer',
        store_name: 'Starters',
        support_email: 'support@starters.com',
        onboarding_link: 'https://yourdomain.com/onboarding',
        ...metadata
      },
      priority: 'normal'
    })
    .select()
    .single();

  if (welcomeEvent.data) {
    events.push(welcomeEvent.data);
  }

  console.log(`Created welcome email for ${userData.email}`);
  return events;
}

async function handleOrderPlacementJourney(
  supabase: any,
  userData: { email: string; name?: string },
  orderData: { order_id: string; order_number: string; total_amount: number; items: any[] },
  metadata?: Record<string, any>
): Promise<any[]> {
  const events = [];

  // Order confirmation email
  const orderConfirmationEvent = await supabase
    .from('communication_events')
    .insert({
      event_type: 'order_confirmation',
      recipient_email: userData.email,
      order_id: orderData.order_id,
      status: 'queued',
      template_key: 'order_confirmation',
      template_variables: {
        customer_name: userData.name || 'Customer',
        order_number: orderData.order_number,
        order_total: `₦${orderData.total_amount.toLocaleString()}`,
        order_date: new Date().toLocaleDateString(),
        items_count: orderData.items.length,
        order_tracking_link: `https://yourdomain.com/track/${orderData.order_id}`,
        store_name: 'Starters',
        ...metadata
      },
      priority: 'high'
    })
    .select()
    .single();

  if (orderConfirmationEvent.data) {
    events.push(orderConfirmationEvent.data);
  }

  // Admin notification
  const { data: businessSettings } = await supabase
    .from('business_settings')
    .select('admin_notification_email, email')
    .limit(1)
    .single();

  const adminEmail = businessSettings?.admin_notification_email || businessSettings?.email;
  
  if (adminEmail) {
    const adminNotificationEvent = await supabase
      .from('communication_events')
      .insert({
        event_type: 'admin_new_order',
        recipient_email: adminEmail,
        order_id: orderData.order_id,
        status: 'queued',
        template_key: 'admin_new_order',
        template_variables: {
          order_number: orderData.order_number,
          customer_name: userData.name || 'Customer',
          customer_email: userData.email,
          order_total: `₦${orderData.total_amount.toLocaleString()}`,
          order_date: new Date().toLocaleDateString(),
          items_count: orderData.items.length,
          order_id: orderData.order_id,
          admin_dashboard_link: 'https://yourdomain.com/admin/orders'
        },
        priority: 'high'
      })
      .select()
      .single();

    if (adminNotificationEvent.data) {
      events.push(adminNotificationEvent.data);
    }
  }

  console.log(`Created order confirmation and admin notification for order ${orderData.order_number}`);
  return events;
}

async function handleOrderStatusChangeJourney(
  supabase: any,
  userData: { email: string; name?: string },
  orderData: { order_id: string; order_number: string; status?: string },
  metadata?: Record<string, any>
): Promise<any[]> {
  const events = [];

  const status = orderData.status || metadata?.new_status;
  if (!status) {
    throw new Error('Order status is required for status change journey');
  }

  // Map status to template
  const statusTemplateMap: Record<string, string> = {
    'confirmed': 'order_confirmed',
    'preparing': 'order_preparing', 
    'ready': 'order_ready',
    'out_for_delivery': 'order_out_for_delivery',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled',
    'completed': 'order_completed',
    'returned': 'order_returned'
  };

  const templateKey = statusTemplateMap[status];
  if (!templateKey) {
    console.warn(`No template found for status: ${status}`);
    return events;
  }

  const statusUpdateEvent = await supabase
    .from('communication_events')
    .insert({
      event_type: 'order_status_update',
      recipient_email: userData.email,
      order_id: orderData.order_id,
      status: 'queued',
      template_key: templateKey,
      template_variables: {
        customer_name: userData.name || 'Valued Customer',
        order_number: orderData.order_number,
        order_status: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        status_date: new Date().toLocaleDateString('en-NG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        business_name: 'Starters Small Chops',
        support_email: 'support@starterssmallchops.com',
        order_id: orderData.order_id,
        old_status: metadata?.old_status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '',
        new_status: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        updated_at: metadata?.updated_at || new Date().toISOString(),
        ...metadata
      },
      priority: 'normal'
    })
    .select()
    .single();

  if (statusUpdateEvent.data) {
    events.push(statusUpdateEvent.data);
  }

  // Log pickup-specific notification for production monitoring
  if (templateKey === 'pickup_ready') {
    console.log(`🚚 PICKUP READY: Notification sent for order ${orderData.order_number} to ${userData.email}`);
    
    // Additional audit log for pickup notifications
    await supabase
      .from('audit_logs')
      .insert({
        action: 'pickup_ready_notification_sent',
        category: 'Order Fulfillment',
        message: `Pickup ready notification sent for order ${orderData.order_number}`,
        entity_id: orderData.order_id,
        new_values: {
          order_id: orderData.order_id,
          order_number: orderData.order_number,
          customer_email: userData.email,
          template_used: templateKey,
          notification_time: new Date().toISOString()
        }
      });
  }

  console.log(`Created status update email for order ${orderData.order_number}: ${status} (template: ${templateKey})`);
  return events;
}

async function handlePasswordResetJourney(
  supabase: any,
  userData: { email: string; name?: string },
  metadata?: Record<string, any>
): Promise<any[]> {
  const events = [];

  const resetToken = metadata?.reset_token || crypto.randomUUID();

  const passwordResetEvent = await supabase
    .from('communication_events')
    .insert({
      event_type: 'password_reset',
      recipient_email: userData.email,
      status: 'queued',
      template_key: 'password_reset',
      template_variables: {
        customer_name: userData.name || 'Customer',
        reset_link: `https://yourdomain.com/reset-password?token=${resetToken}`,
        reset_token: resetToken,
        expiry_time: '24 hours',
        support_email: 'support@starters.com',
        ...metadata
      },
      priority: 'high'
    })
    .select()
    .single();

  if (passwordResetEvent.data) {
    events.push(passwordResetEvent.data);
  }

  console.log(`Created password reset email for ${userData.email}`);
  return events;
}
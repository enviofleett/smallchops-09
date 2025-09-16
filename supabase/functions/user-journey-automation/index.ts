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

  try {
    // Import communication utilities for robust handling
    const { upsertCommunicationEventSafe } = await import('../_shared/communication-utils.ts');
    
    // Create welcome email with robust handling
    const eventResult = await upsertCommunicationEventSafe(supabase, {
      event_type: 'customer_welcome',
      recipient_email: userData.email,
      template_key: 'customer_welcome',
      template_variables: {
        customer_name: userData.name || 'New Customer',
        store_name: 'Starters',
        support_email: 'support@starters.com',
        onboarding_link: 'https://yourdomain.com/onboarding',
        ...metadata
      },
      priority: 'normal'
    });

    if (eventResult.success) {
      console.log(`✅ Created welcome email for ${userData.email}`, {
        event_id: eventResult.event_id,
        attempts: eventResult.attempts,
        isDuplicate: eventResult.isDuplicate
      });
      
      if (!eventResult.isDuplicate) {
        events.push({ id: eventResult.event_id, type: 'customer_welcome' });
      }
    } else {
      console.error(`❌ Failed to create welcome email for ${userData.email}:`, eventResult.error);
    }
  } catch (error) {
    console.error('Error in registration journey:', error);
    // Don't throw - allow journey to continue
  }

  return events;
}

async function handleOrderPlacementJourney(
  supabase: any,
  userData: { email: string; name?: string },
  orderData: { order_id: string; order_number: string; total_amount: number; items: any[] },
  metadata?: Record<string, any>
): Promise<any[]> {
  const events = [];

  try {
    // Import communication utilities for robust handling
    const { upsertCommunicationEventSafe } = await import('../_shared/communication-utils.ts');
    
    // Order confirmation email with robust handling
    const confirmationResult = await upsertCommunicationEventSafe(supabase, {
      event_type: 'order_confirmation',
      recipient_email: userData.email,
      order_id: orderData.order_id,
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
    });

    if (confirmationResult.success) {
      console.log(`✅ Order confirmation created for ${orderData.order_number}`, {
        event_id: confirmationResult.event_id,
        attempts: confirmationResult.attempts,
        isDuplicate: confirmationResult.isDuplicate
      });
      
      if (!confirmationResult.isDuplicate) {
        events.push({ id: confirmationResult.event_id, type: 'order_confirmation' });
      }
    } else {
      console.error(`❌ Failed to create order confirmation for ${orderData.order_number}:`, confirmationResult.error);
    }

    // Admin notification with separate dedupe key
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('admin_notification_email')
      .limit(1)
      .single();

    const adminEmail = businessSettings?.admin_notification_email;
    
    if (adminEmail) {
      // Admin notification with robust handling
      const adminResult = await upsertCommunicationEventSafe(supabase, {
        event_type: 'admin_new_order',
        recipient_email: adminEmail,
        order_id: orderData.order_id,
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
      });

      if (adminResult.success) {
        console.log(`✅ Admin notification created for ${orderData.order_number}`, {
          event_id: adminResult.event_id,
          attempts: adminResult.attempts,
          isDuplicate: adminResult.isDuplicate
        });
        
        if (!adminResult.isDuplicate) {
          events.push({ id: adminResult.event_id, type: 'admin_new_order' });
        }
      } else {
        console.error(`❌ Failed to create admin notification for ${orderData.order_number}:`, adminResult.error);
      }
    }
  } catch (error) {
    console.error('Error in order placement journey:', error);
    // Don't throw - allow order placement to continue
  }

  console.log(`✅ Created ${events.length} communication events for order ${orderData.order_number}`);
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

  // Get order details to check fulfillment type
  const { data: orderDetails, error: orderError } = await supabase
    .from('orders')
    .select('id, order_type, order_number, customer_email, customer_name')
    .eq('id', orderData.order_id)
    .single();

  if (orderError) {
    console.error('Failed to fetch order details:', orderError);
    throw new Error(`Failed to fetch order details: ${orderError.message}`);
  }

  // Special handling for delivery orders changing to "out_for_delivery"
  if (status === 'out_for_delivery' && orderDetails.order_type === 'delivery') {
    console.log(`🚚 DELIVERY OUT FOR DELIVERY: Processing delivery notification for order ${orderData.order_number}`);
    
    try {
      // Call the dedicated delivery notification function with driver info
      const { data: deliveryEmailResponse, error: deliveryEmailError } = await supabase.functions.invoke('send-out-for-delivery-email', {
        body: {
          order_id: orderData.order_id
        }
      });

      if (deliveryEmailError) {
        console.error('Failed to send delivery notification:', deliveryEmailError);
        throw new Error(`Failed to send delivery notification: ${deliveryEmailError.message}`);
      }

      // Log successful delivery notification
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delivery_out_for_delivery_notification_sent',
          category: 'Order Fulfillment',
          message: `Delivery out-for-delivery notification with driver info sent for order ${orderData.order_number}`,
          entity_id: orderData.order_id,
          new_values: {
            order_id: orderData.order_id,
            order_number: orderData.order_number,
            customer_email: orderDetails.customer_email,
            fulfillment_type: 'delivery',
            notification_type: 'out_for_delivery_with_driver',
            notification_time: new Date().toISOString(),
            email_response: deliveryEmailResponse
          }
        });

      console.log(`✅ Delivery notification sent successfully for order ${orderData.order_number}`);
      
      // Return early - the dedicated function handles the email
      return events;
      
    } catch (error: any) {
      console.error('Error in delivery notification process:', error);
      
      // Log the failure
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delivery_notification_failed',
          category: 'Order Fulfillment',
          message: `Failed to send delivery notification for order ${orderData.order_number}: ${error.message}`,
          entity_id: orderData.order_id,
          new_values: {
            order_id: orderData.order_id,
            order_number: orderData.order_number,
            error: error.message,
            fulfillment_type: 'delivery',
            failed_at: new Date().toISOString()
          }
        });

      // Continue with standard template-based notification as fallback
      console.log('Falling back to standard template notification...');
    }
  }

  // Check for existing ready emails to prevent duplicates
  if (status === 'ready') {
    const { data: existingReadyEmail } = await supabase
      .from('communication_events')
      .select('id')
      .eq('order_id', orderData.order_id)
      .eq('event_type', 'order_status_update')
      .eq('template_key', 'order_ready')
      .eq('status', 'sent')
      .limit(1);

    if (existingReadyEmail && existingReadyEmail.length > 0) {
      console.log(`⚠️ Order ${orderData.order_number} already has ready notification sent, skipping duplicate`);
      return events;
    }
  }

  // Map status to correct template keys that exist in enhanced_email_templates
  const statusTemplateMap: Record<string, string> = {
    'confirmed': 'order_confirmation',    // Fix: changed from order_confirmed
    'preparing': 'order_processing',     // Fix: changed from order_preparing
    'ready': 'order_ready',
    'out_for_delivery': 'order_out_for_delivery',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancellation',    // Fix: changed from order_cancelled
    'completed': 'order_completed',
    'returned': 'order_returned'
  };

  const templateKey = statusTemplateMap[status];
  if (!templateKey) {
    console.warn(`❌ No template found for status: ${status}. Available mappings:`, Object.keys(statusTemplateMap));
    return events;
  }

  console.log(`📧 Using template key: ${templateKey} for status: ${status}`);

  try {
    // Import communication utilities for robust handling
    const { upsertCommunicationEventSafe } = await import('../_shared/communication-utils.ts');
    
    // Status update email with robust handling
    const statusResult = await upsertCommunicationEventSafe(supabase, {
      event_type: 'order_status_update',
      recipient_email: userData.email,
      order_id: orderData.order_id,
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
        fulfillment_type: orderDetails.order_type,
        ...metadata
      },
      priority: 'normal'
    });

    if (statusResult.success) {
      console.log(`✅ Status update notification created for order ${orderData.order_number} status ${status}`, {
        event_id: statusResult.event_id,
        attempts: statusResult.attempts,
        isDuplicate: statusResult.isDuplicate
      });
      
      if (!statusResult.isDuplicate) {
        events.push({ id: statusResult.event_id, type: 'order_status_update' });
      }
    } else {
        console.error('Failed to create status update event:', statusResult.error);
        throw statusResult.error;
    }
  } catch (error) {
    console.error(`Error creating status update event for order ${orderData.order_number}:`, error);
    // Don't throw - allow status update to continue
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
          fulfillment_type: 'pickup',
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
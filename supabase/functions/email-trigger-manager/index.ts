import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerEvent {
  eventType: string;
  entityId?: string;
  userId?: string;
  email?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

// Email trigger handlers for different events
const TRIGGER_HANDLERS = {
  // Customer lifecycle triggers
  customer_registered: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing customer registration trigger');
    
    const customerData = {
      customerEmail: event.email || event.data.email,
      customerName: event.data.name || event.data.customerName,
      authProvider: event.data.authProvider || 'email',
      registrationDate: event.data.registrationDate || new Date().toISOString(),
      welcomeEmailSent: false
    };

    // Trigger welcome email automation
    await supabase.functions.invoke('email-automation-trigger', {
      body: {
        action: 'trigger',
        eventType: 'customer_registered',
        data: customerData
      }
    });

    // Log trigger event
    await logTriggerEvent(supabase, 'customer_registered', customerData);
  },

  // Order lifecycle triggers
  order_created: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing order creation trigger');
    
    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*)
      `)
      .eq('id', event.entityId)
      .single();

    if (!order) {
      throw new Error(`Order ${event.entityId} not found`);
    }

    const orderData = {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      totalAmount: order.total_amount,
      orderType: order.order_type,
      items: order.order_items,
      createdAt: order.created_at
    };

    // Trigger order confirmation email
    await supabase.functions.invoke('email-automation-trigger', {
      body: {
        action: 'trigger',
        eventType: 'order_created',
        data: orderData
      }
    });

    // Trigger admin notification
    await supabase.functions.invoke('admin-order-notification', {
      body: orderData
    });

    await logTriggerEvent(supabase, 'order_created', orderData);
  },

  order_status_changed: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing order status change trigger');
    
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', event.entityId)
      .single();

    const statusData = {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      oldStatus: event.data.oldStatus,
      newStatus: event.data.newStatus,
      changedAt: new Date().toISOString()
    };

    await supabase.functions.invoke('email-automation-trigger', {
      body: {
        action: 'trigger',
        eventType: 'order_status_changed',
        data: statusData
      }
    });

    await logTriggerEvent(supabase, 'order_status_changed', statusData);
  },

  payment_completed: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing payment completion trigger');
    
    const paymentData = {
      orderId: event.entityId,
      customerEmail: event.data.customerEmail,
      customerName: event.data.customerName,
      amount: event.data.amount,
      paymentMethod: event.data.paymentMethod,
      completedAt: new Date().toISOString()
    };

    // Send payment confirmation
    await supabase.functions.invoke('supabase-auth-email-sender', {
      body: {
        templateId: 'payment_confirmation',
        to: paymentData.customerEmail,
        variables: paymentData,
        emailType: 'transactional'
      }
    });

    await logTriggerEvent(supabase, 'payment_completed', paymentData);
  },

  // Cart abandonment triggers
  cart_abandoned: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing cart abandonment trigger');
    
    const cartData = {
      customerEmail: event.email || event.data.email,
      customerName: event.data.customerName,
      cartItems: event.data.items || [],
      cartTotal: event.data.total || 0,
      cartId: event.data.cartId,
      abandonedAt: new Date().toISOString(),
      checkoutUrl: `https://startersmallchops.com/checkout?recover=${event.data.cartId}`
    };

    // Only trigger if cart value is significant
    if (cartData.cartTotal >= 1000) {
      await supabase.functions.invoke('email-automation-trigger', {
        body: {
          action: 'trigger',
          eventType: 'cart_abandoned',
          data: cartData
        }
      });
    }

    await logTriggerEvent(supabase, 'cart_abandoned', cartData);
  },

  // Customer engagement triggers
  customer_inactive: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing customer inactivity trigger');
    
    const { data: lastOrder } = await supabase
      .from('orders')
      .select('created_at, total_amount')
      .eq('customer_email', event.email)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const inactivityData = {
      customerEmail: event.email,
      customerName: event.data.customerName,
      lastOrderDate: lastOrder?.created_at,
      lastOrderAmount: lastOrder?.total_amount,
      daysSinceLastOrder: event.data.daysSinceLastOrder,
      specialOfferUrl: 'https://startersmallchops.com/special-offers'
    };

    await supabase.functions.invoke('email-automation-trigger', {
      body: {
        action: 'trigger',
        eventType: 'customer_inactive',
        data: inactivityData
      }
    });

    await logTriggerEvent(supabase, 'customer_inactive', inactivityData);
  },

  // Feedback and review triggers
  delivery_completed: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing delivery completion trigger');
    
    const deliveryData = {
      orderId: event.entityId,
      customerEmail: event.data.customerEmail,
      customerName: event.data.customerName,
      orderNumber: event.data.orderNumber,
      deliveredAt: new Date().toISOString(),
      feedbackUrl: `https://startersmallchops.com/feedback?order=${event.entityId}`
    };

    // Send delivery confirmation and request feedback
    await supabase.functions.invoke('supabase-auth-email-sender', {
      body: {
        templateId: 'delivery_completed',
        to: deliveryData.customerEmail,
        variables: deliveryData,
        emailType: 'transactional'
      }
    });

    // Schedule feedback request for 2 hours later
    await supabase.from('email_automation_queue').insert({
      flow_id: 'feedback_request',
      action_index: 0,
      trigger_data: deliveryData,
      execute_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled'
    });

    await logTriggerEvent(supabase, 'delivery_completed', deliveryData);
  },

  // Marketing triggers
  new_menu_item: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing new menu item trigger');
    
    // Get active customers who haven't unsubscribed from marketing
    const { data: customers } = await supabase
      .from('customer_accounts')
      .select('email, name')
      .eq('email_verified', true)
      .eq('marketing_consent', true);

    const menuData = {
      itemName: event.data.name,
      itemDescription: event.data.description,
      itemPrice: event.data.price,
      itemImage: event.data.image_url,
      orderUrl: 'https://startersmallchops.com/menu'
    };

    // Send to all subscribed customers
    for (const customer of customers || []) {
      await supabase.functions.invoke('supabase-auth-email-sender', {
        body: {
          templateId: 'new_menu_item',
          to: customer.email,
          variables: {
            customerName: customer.name,
            ...menuData
          },
          emailType: 'marketing'
        }
      });
    }

    await logTriggerEvent(supabase, 'new_menu_item', { ...menuData, recipientCount: customers?.length || 0 });
  },

  promotion_started: async (supabase: any, event: TriggerEvent) => {
    console.log('Processing promotion start trigger');
    
    const promotionData = {
      promotionTitle: event.data.title,
      promotionDescription: event.data.description,
      discountPercent: event.data.discount_percent,
      validUntil: event.data.valid_until,
      promoCode: event.data.promo_code,
      ctaUrl: 'https://startersmallchops.com/promotions'
    };

    // Get customers based on targeting criteria
    let query = supabase
      .from('customer_accounts')
      .select('email, name')
      .eq('email_verified', true)
      .eq('marketing_consent', true);

    // Apply targeting filters
    if (event.data.targeting?.lastOrderDays) {
      const cutoffDate = new Date(Date.now() - event.data.targeting.lastOrderDays * 24 * 60 * 60 * 1000);
      query = query.gte('last_order_date', cutoffDate.toISOString());
    }

    const { data: targetCustomers } = await query;

    for (const customer of targetCustomers || []) {
      await supabase.functions.invoke('supabase-auth-email-sender', {
        body: {
          templateId: 'promotion_announcement',
          to: customer.email,
          variables: {
            customerName: customer.name,
            ...promotionData
          },
          emailType: 'marketing'
        }
      });
    }

    await logTriggerEvent(supabase, 'promotion_started', { ...promotionData, recipientCount: targetCustomers?.length || 0 });
  }
};

async function logTriggerEvent(supabase: any, eventType: string, data: Record<string, any>) {
  await supabase.from('email_trigger_logs').insert({
    event_type: eventType,
    trigger_data: data,
    processed_at: new Date().toISOString(),
    status: 'processed'
  });
}

// Detect and trigger cart abandonment events
async function detectCartAbandonments(supabase: any) {
  console.log('Checking for cart abandonments...');
  
  // Look for sessions with items but no recent orders (1 hour threshold)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // This would typically query your cart/session storage
  // For now, we'll simulate with a placeholder
  console.log('Cart abandonment detection would run here');
}

// Detect inactive customers
async function detectInactiveCustomers(supabase: any) {
  console.log('Checking for inactive customers...');
  
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const { data: inactiveCustomers } = await supabase
    .from('customer_accounts')
    .select(`
      email, 
      name,
      last_order_date,
      created_at
    `)
    .eq('email_verified', true)
    .lt('last_order_date', thirtyDaysAgo.toISOString())
    .is('reactivation_email_sent', null);

  console.log(`Found ${inactiveCustomers?.length || 0} inactive customers`);

  for (const customer of inactiveCustomers || []) {
    const daysSinceLastOrder = Math.floor(
      (Date.now() - new Date(customer.last_order_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    await TRIGGER_HANDLERS.customer_inactive(supabase, {
      eventType: 'customer_inactive',
      email: customer.email,
      data: {
        customerName: customer.name,
        daysSinceLastOrder
      }
    });

    // Mark as processed
    await supabase
      .from('customer_accounts')
      .update({ reactivation_email_sent: new Date().toISOString() })
      .eq('email', customer.email);
  }
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

    const body = await req.json();
    const { action, eventType, ...eventData } = body;

    console.log(`Email trigger manager processing: ${action || eventType}`);

    if (action === 'detect_abandonments') {
      await detectCartAbandonments(supabaseAdmin);
    } else if (action === 'detect_inactive') {
      await detectInactiveCustomers(supabaseAdmin);
    } else if (eventType && TRIGGER_HANDLERS[eventType]) {
      const event: TriggerEvent = {
        eventType,
        entityId: eventData.entityId,
        userId: eventData.userId,
        email: eventData.email,
        data: eventData.data || eventData,
        metadata: eventData.metadata
      };

      await TRIGGER_HANDLERS[eventType](supabaseAdmin, event);
    } else {
      throw new Error(`Unknown action or event type: ${action || eventType}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email trigger ${action || eventType} processed successfully` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email trigger manager error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Email trigger processing failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

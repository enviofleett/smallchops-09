import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailFlow {
  id: string;
  type: string;
  trigger: string;
  conditions: Record<string, any>;
  actions: EmailAction[];
  isActive: boolean;
}

interface EmailAction {
  type: 'send_email' | 'wait' | 'condition_check' | 'update_status';
  templateKey?: string;
  delay?: number;
  condition?: string;
  data?: Record<string, any>;
}

interface EmailTrigger {
  eventType: string;
  conditions: Record<string, any>;
  data: Record<string, any>;
  timestamp: string;
}

// Email automation flows configuration
const EMAIL_FLOWS: Record<string, EmailFlow> = {
  'customer_onboarding': {
    id: 'customer_onboarding',
    type: 'sequence',
    trigger: 'customer_registered',
    conditions: { authProvider: ['email', 'oauth'] },
    isActive: true,
    actions: [
      { type: 'send_email', templateKey: 'customer_welcome', delay: 0 },
      { type: 'wait', delay: 24 * 60 }, // 24 hours
      { type: 'condition_check', condition: 'no_first_order' },
      { type: 'send_email', templateKey: 'first_order_reminder', delay: 0 },
      { type: 'wait', delay: 72 * 60 }, // 3 days
      { type: 'send_email', templateKey: 'menu_highlights', delay: 0 }
    ]
  },
  'order_lifecycle': {
    id: 'order_lifecycle',
    type: 'transactional',
    trigger: 'order_created',
    conditions: {},
    isActive: true,
    actions: [
      { type: 'send_email', templateKey: 'order_confirmation', delay: 0 },
      { type: 'wait', delay: 30 }, // 30 minutes
      { type: 'condition_check', condition: 'order_not_paid' },
      { type: 'send_email', templateKey: 'payment_reminder', delay: 0 }
    ]
  },
  'cart_abandonment': {
    id: 'cart_abandonment',
    type: 'marketing',
    trigger: 'cart_abandoned',
    conditions: { cartValue: { min: 1000 } }, // Minimum ₦1000 cart
    isActive: true,
    actions: [
      { type: 'wait', delay: 60 }, // 1 hour
      { type: 'send_email', templateKey: 'cart_reminder_1', delay: 0 },
      { type: 'wait', delay: 24 * 60 }, // 24 hours
      { type: 'condition_check', condition: 'cart_still_abandoned' },
      { type: 'send_email', templateKey: 'cart_reminder_2', delay: 0 },
      { type: 'wait', delay: 72 * 60 }, // 3 days
      { type: 'send_email', templateKey: 'final_cart_reminder', delay: 0 }
    ]
  },
  'customer_reactivation': {
    id: 'customer_reactivation',
    type: 'marketing',
    trigger: 'customer_inactive',
    conditions: { lastOrderDays: { min: 30 } },
    isActive: true,
    actions: [
      { type: 'send_email', templateKey: 'we_miss_you', delay: 0 },
      { type: 'wait', delay: 7 * 24 * 60 }, // 7 days
      { type: 'condition_check', condition: 'still_inactive' },
      { type: 'send_email', templateKey: 'special_comeback_offer', delay: 0 }
    ]
  },
  'order_status_updates': {
    id: 'order_status_updates',
    type: 'transactional',
    trigger: 'order_status_changed',
    conditions: {},
    isActive: true,
    actions: [
      { type: 'condition_check', condition: 'status_is_confirmed' },
      { type: 'send_email', templateKey: 'order_confirmed', delay: 0 },
      { type: 'condition_check', condition: 'status_is_preparing' },
      { type: 'send_email', templateKey: 'order_preparing', delay: 0 },
      { type: 'condition_check', condition: 'status_is_ready' },
      { type: 'send_email', templateKey: 'order_ready', delay: 0 },
      { type: 'condition_check', condition: 'status_is_delivered' },
      { type: 'send_email', templateKey: 'order_delivered', delay: 0 },
      { type: 'wait', delay: 2 * 60 }, // 2 hours after delivery
      { type: 'send_email', templateKey: 'delivery_feedback', delay: 0 }
    ]
  }
};

// Condition evaluation functions
const CONDITIONS = {
  no_first_order: async (supabase: any, data: any) => {
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', data.customerEmail)
      .eq('status', 'confirmed')
      .limit(1);
    return !orders || orders.length === 0;
  },
  
  order_not_paid: async (supabase: any, data: any) => {
    const { data: order } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', data.orderId)
      .single();
    return order?.payment_status !== 'paid';
  },
  
  cart_still_abandoned: async (supabase: any, data: any) => {
    // Check if cart hasn't been converted to order
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', data.customerEmail)
      .gte('created_at', data.cartAbandonedAt)
      .limit(1);
    return !orders || orders.length === 0;
  },
  
  still_inactive: async (supabase: any, data: any) => {
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_email', data.customerEmail)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    return !orders || orders.length === 0;
  },
  
  status_is_confirmed: (data: any) => data.newStatus === 'confirmed',
  status_is_preparing: (data: any) => data.newStatus === 'preparing',
  status_is_ready: (data: any) => data.newStatus === 'ready',
  status_is_delivered: (data: any) => data.newStatus === 'delivered'
};

async function processEmailFlow(
  supabase: any, 
  flowId: string, 
  triggerData: any, 
  startActionIndex = 0
): Promise<boolean> {
  const flow = EMAIL_FLOWS[flowId];
  if (!flow || !flow.isActive) {
    console.log(`Flow ${flowId} not found or inactive`);
    return false;
  }

  console.log(`Processing flow: ${flowId}, starting at action ${startActionIndex}`);

  // Check flow conditions
  if (flow.conditions && !evaluateConditions(flow.conditions, triggerData)) {
    console.log(`Flow ${flowId} conditions not met`);
    return false;
  }

  for (let i = startActionIndex; i < flow.actions.length; i++) {
    const action = flow.actions[i];
    
    try {
      await processAction(supabase, action, triggerData, flow, i);
    } catch (error) {
      console.error(`Error processing action ${i} in flow ${flowId}:`, error);
      
      // Log error and create retry
      await supabase.from('email_automation_errors').insert({
        flow_id: flowId,
        action_index: i,
        trigger_data: triggerData,
        error_message: error.message,
        retry_count: 0
      });
      
      return false;
    }
  }

  return true;
}

async function processAction(
  supabase: any, 
  action: EmailAction, 
  triggerData: any, 
  flow: EmailFlow, 
  actionIndex: number
) {
  switch (action.type) {
    case 'send_email':
      await sendEmail(supabase, action.templateKey!, triggerData);
      break;
      
    case 'wait':
      if (action.delay && action.delay > 0) {
        // Schedule next action
        await scheduleDelayedAction(supabase, flow.id, actionIndex + 1, triggerData, action.delay);
        return; // Exit here, next action will be processed later
      }
      break;
      
    case 'condition_check':
      if (action.condition) {
        const conditionMet = await evaluateCondition(supabase, action.condition, triggerData);
        if (!conditionMet) {
          console.log(`Condition ${action.condition} not met, skipping remaining actions`);
          return; // Exit flow
        }
      }
      break;
      
    case 'update_status':
      if (action.data) {
        await updateCustomerStatus(supabase, triggerData.customerEmail, action.data);
      }
      break;
  }
}

async function sendEmail(supabase: any, templateKey: string, data: any) {
  console.log(`Sending email with template: ${templateKey}`);
  
  const emailData = {
    templateId: templateKey,
    to: data.customerEmail || data.recipient_email,
    variables: {
      customerName: data.customerName || data.customer_name || 'Valued Customer',
      ...data
    },
    emailType: 'automated'
  };

  // Try Auth email sender first, fallback to SMTP
  try {
    const { error: authError } = await supabase.functions.invoke('supabase-auth-email-sender', {
      body: emailData
    });
    
    if (authError) {
      console.warn('Auth email failed, trying SMTP:', authError);
      await supabase.functions.invoke('smtp-email-sender', { body: emailData });
    }
    
    // Log email sent
    await supabase.from('email_automation_logs').insert({
      template_key: templateKey,
      recipient_email: emailData.to,
      flow_type: 'automated',
      status: 'sent',
      variables: emailData.variables
    });
    
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

async function scheduleDelayedAction(
  supabase: any, 
  flowId: string, 
  nextActionIndex: number, 
  triggerData: any, 
  delayMinutes: number
) {
  const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  await supabase.from('email_automation_queue').insert({
    flow_id: flowId,
    action_index: nextActionIndex,
    trigger_data: triggerData,
    execute_at: executeAt.toISOString(),
    status: 'scheduled'
  });
  
  console.log(`Scheduled next action for ${flowId} at ${executeAt}`);
}

function evaluateConditions(conditions: Record<string, any>, data: any): boolean {
  for (const [key, condition] of Object.entries(conditions)) {
    const value = data[key];
    
    if (Array.isArray(condition)) {
      if (!condition.includes(value)) return false;
    } else if (typeof condition === 'object' && condition.min !== undefined) {
      if (value < condition.min) return false;
    } else if (condition !== value) {
      return false;
    }
  }
  return true;
}

async function evaluateCondition(supabase: any, conditionName: string, data: any): Promise<boolean> {
  const conditionFn = CONDITIONS[conditionName as keyof typeof CONDITIONS];
  if (!conditionFn) {
    console.warn(`Condition ${conditionName} not found`);
    return true;
  }
  
  return await conditionFn(supabase, data);
}

async function updateCustomerStatus(supabase: any, email: string, updates: Record<string, any>) {
  await supabase
    .from('customer_accounts')
    .update(updates)
    .eq('email', email);
}

// Process scheduled email automation queue
async function processScheduledEmails(supabase: any) {
  const now = new Date().toISOString();
  
  const { data: scheduledEmails, error } = await supabase
    .from('email_automation_queue')
    .select('*')
    .eq('status', 'scheduled')
    .lte('execute_at', now)
    .order('execute_at', { ascending: true })
    .limit(50);

  if (error) {
    console.error('Error fetching scheduled emails:', error);
    return;
  }

  console.log(`Processing ${scheduledEmails?.length || 0} scheduled emails`);

  for (const item of scheduledEmails || []) {
    try {
      // Mark as processing
      await supabase
        .from('email_automation_queue')
        .update({ status: 'processing', processed_at: new Date().toISOString() })
        .eq('id', item.id);

      // Process the flow from the specified action index
      await processEmailFlow(
        supabase, 
        item.flow_id, 
        item.trigger_data, 
        item.action_index
      );

      // Mark as completed
      await supabase
        .from('email_automation_queue')
        .update({ status: 'completed' })
        .eq('id', item.id);

    } catch (error) {
      console.error(`Error processing scheduled email ${item.id}:`, error);
      
      // Mark as failed and increment retry count
      await supabase
        .from('email_automation_queue')
        .update({ 
          status: 'failed', 
          error_message: error.message,
          retry_count: (item.retry_count || 0) + 1
        })
        .eq('id', item.id);
    }
  }
}

// Handle various email triggers
async function handleEmailTrigger(supabase: any, trigger: EmailTrigger) {
  console.log(`Processing email trigger: ${trigger.eventType}`);

  switch (trigger.eventType) {
    case 'customer_registered':
      await processEmailFlow(supabase, 'customer_onboarding', trigger.data);
      break;
      
    case 'order_created':
      await processEmailFlow(supabase, 'order_lifecycle', trigger.data);
      break;
      
    case 'cart_abandoned':
      await processEmailFlow(supabase, 'cart_abandonment', trigger.data);
      break;
      
    case 'order_status_changed':
      await processEmailFlow(supabase, 'order_status_updates', trigger.data);
      break;
      
    case 'customer_inactive':
      await processEmailFlow(supabase, 'customer_reactivation', trigger.data);
      break;
      
    default:
      console.log(`No flow configured for trigger: ${trigger.eventType}`);
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
    const { action, ...data } = body;

    console.log(`Email automation engine processing: ${action}`);

    switch (action) {
      case 'trigger':
        const trigger: EmailTrigger = {
          eventType: data.eventType,
          conditions: data.conditions || {},
          data: data.data || {},
          timestamp: new Date().toISOString()
        };
        await handleEmailTrigger(supabaseAdmin, trigger);
        break;
        
      case 'process_queue':
        await processScheduledEmails(supabaseAdmin);
        break;
        
      case 'process_flow':
        await processEmailFlow(supabaseAdmin, data.flowId, data.triggerData, data.startIndex || 0);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log automation activity
    await supabaseAdmin.from('automation_activity_logs').insert({
      action,
      data,
      status: 'success',
      processed_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Email automation ${action} completed successfully` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email automation engine error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Email automation processing failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
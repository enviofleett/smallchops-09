import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QueuedEmail {
  id: string;
  recipient_email: string;
  template_key: string;
  variables: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
  status: 'queued' | 'processing' | 'sent' | 'failed';
  retry_count: number;
  scheduled_at?: string;
  created_at: string;
}

// Email processing priorities
const PRIORITY_LIMITS = {
  high: 20,    // Process up to 20 high-priority emails per batch
  normal: 50,  // Process up to 50 normal-priority emails per batch
  low: 30      // Process up to 30 low-priority emails per batch
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelayMinutes: [5, 15, 60], // 5 min, 15 min, 1 hour
  exponentialBackoff: true
};

async function processEmailQueue(supabase: any, priority: 'high' | 'normal' | 'low' = 'normal') {
  console.log(`Processing ${priority} priority email queue...`);
  
  const limit = PRIORITY_LIMITS[priority];
  const now = new Date().toISOString();
  
  // Fetch queued emails by priority
  const { data: queuedEmails, error } = await supabase
    .from('communication_events')
    .select('*')
    .eq('status', 'queued')
    .eq('priority', priority)
    .lte('scheduled_at', now)
    .lt('retry_count', RETRY_CONFIG.maxRetries)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`Error fetching ${priority} priority emails:`, error);
    throw error;
  }

  if (!queuedEmails || queuedEmails.length === 0) {
    console.log(`No ${priority} priority emails to process`);
    return { processed: 0, successful: 0, failed: 0 };
  }

  console.log(`Found ${queuedEmails.length} ${priority} priority emails to process`);

  let successful = 0;
  let failed = 0;

  // Process emails with concurrency control
  const concurrencyLimit = priority === 'high' ? 5 : priority === 'normal' ? 3 : 2;
  const emailBatches = chunkArray(queuedEmails, concurrencyLimit);

  for (const batch of emailBatches) {
    const batchPromises = batch.map(email => processIndividualEmail(supabase, email));
    const results = await Promise.allSettled(batchPromises);
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        successful++;
      } else {
        failed++;
        console.error('Email processing failed:', result.status === 'rejected' ? result.reason : 'Unknown error');
      }
    });

    // Add delay between batches to prevent overwhelming the SMTP server
    if (emailBatches.indexOf(batch) < emailBatches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  // Log batch processing results
  await supabase.from('email_batch_logs').insert({
    priority,
    total_processed: queuedEmails.length,
    successful,
    failed,
    processed_at: new Date().toISOString()
  });

  console.log(`${priority} priority batch completed: ${successful} successful, ${failed} failed`);
  
  return { processed: queuedEmails.length, successful, failed };
}

async function processIndividualEmail(supabase: any, email: QueuedEmail): Promise<boolean> {
  const startTime = Date.now();
  
  try {
    console.log(`Processing email ${email.id} to ${email.recipient_email}`);
    
    // Mark as processing
    await supabase
      .from('communication_events')
      .update({ 
        status: 'processing', 
        processing_started_at: new Date().toISOString() 
      })
      .eq('id', email.id);

    // Check for email suppression
    const { data: isSuppressed } = await supabase
      .rpc('is_email_suppressed', { email_address: email.recipient_email });

    if (isSuppressed) {
      console.log(`Email ${email.recipient_email} is suppressed, skipping`);
      await supabase
        .from('communication_events')
        .update({ 
          status: 'cancelled', 
          error_message: 'Email address is suppressed',
          processed_at: new Date().toISOString()
        })
        .eq('id', email.id);
      return false;
    }

    // Rate limiting check
    const { data: rateLimitCheck } = await supabase
      .rpc('check_email_rate_limit', { 
        email_address: email.recipient_email,
        time_window_minutes: 60 
      });

    if (rateLimitCheck && !rateLimitCheck.allowed) {
      console.log(`Rate limit exceeded for ${email.recipient_email}, rescheduling`);
      await rescheduleEmail(supabase, email, 30); // Reschedule for 30 minutes later
      return false;
    }

    // Select email sender based on priority and template type
    const senderFunction = selectEmailSender(email);
    
    // Prepare email data
    const emailData = {
      templateId: email.template_key,
      to: email.recipient_email,
      variables: email.variables || {},
      emailType: getEmailType(email.template_key),
      priority: email.priority
    };

    // Send email via selected sender
    const { data: sendResult, error: sendError } = await supabase.functions.invoke(senderFunction, {
      body: emailData
    });

    if (sendError) {
      throw new Error(`Email sender error: ${sendError.message}`);
    }

    const processingTime = Date.now() - startTime;

    // Mark as sent
    await supabase
      .from('communication_events')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString(),
        processing_time_ms: processingTime,
        external_id: sendResult?.messageId,
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);

    // Update rate limit counter
    await supabase.rpc('increment_email_rate_limit', {
      email_address: email.recipient_email
    });

    // Log successful delivery
    await supabase.from('email_delivery_logs').insert({
      communication_event_id: email.id,
      recipient_email: email.recipient_email,
      template_key: email.template_key,
      delivery_status: 'delivered',
      provider: senderFunction,
      processing_time_ms: processingTime,
      delivered_at: new Date().toISOString()
    });

    console.log(`✅ Email ${email.id} sent successfully in ${processingTime}ms`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to process email ${email.id}:`, error);
    
    const newRetryCount = (email.retry_count || 0) + 1;
    const isMaxRetries = newRetryCount >= RETRY_CONFIG.maxRetries;
    
    await supabase
      .from('communication_events')
      .update({ 
        status: isMaxRetries ? 'failed' : 'queued',
        retry_count: newRetryCount,
        error_message: error.message,
        processed_at: new Date().toISOString(),
        scheduled_at: isMaxRetries ? null : calculateRetryTime(newRetryCount)
      })
      .eq('id', email.id);

    // Log failure
    await supabase.from('email_delivery_logs').insert({
      communication_event_id: email.id,
      recipient_email: email.recipient_email,
      template_key: email.template_key,
      delivery_status: 'failed',
      error_message: error.message,
      retry_count: newRetryCount,
      failed_at: new Date().toISOString()
    });

    if (isMaxRetries) {
      // Send to dead letter queue for manual review
      await supabase.from('email_dead_letter_queue').insert({
        original_communication_event_id: email.id,
        recipient_email: email.recipient_email,
        template_key: email.template_key,
        variables: email.variables,
        final_error: error.message,
        total_attempts: newRetryCount,
        moved_to_dlq_at: new Date().toISOString()
      });
    }

    return false;
  }
}

function selectEmailSender(email: QueuedEmail): string {
  // All emails now use the unified SMTP sender function
  // This ensures consistent delivery through a single, reliable SMTP channel
  return 'smtp-email-sender';
}

function isTransactionalEmail(templateKey: string): boolean {
  const transactionalTemplates = [
    'order_confirmation',
    'payment_confirmation',
    'order_status_update',
    'delivery_confirmation',
    'password_reset',
    'email_verification'
  ];
  
  return transactionalTemplates.some(template => templateKey.includes(template));
}

function getEmailType(templateKey: string): string {
  if (isTransactionalEmail(templateKey)) {
    return 'transactional';
  }
  
  const marketingTemplates = ['promotion', 'newsletter', 'abandoned_cart', 'reactivation'];
  if (marketingTemplates.some(template => templateKey.includes(template))) {
    return 'marketing';
  }
  
  return 'system';
}

function calculateRetryTime(retryCount: number): string {
  const delayMinutes = RETRY_CONFIG.retryDelayMinutes[retryCount - 1] || 60;
  const retryTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  return retryTime.toISOString();
}

async function rescheduleEmail(supabase: any, email: QueuedEmail, delayMinutes: number) {
  const newScheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  
  await supabase
    .from('communication_events')
    .update({ 
      status: 'queued',
      scheduled_at: newScheduledTime.toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', email.id);
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Clean up old processed emails
async function cleanupProcessedEmails(supabase: any) {
  console.log('Cleaning up old processed emails...');
  
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  
  const { data, error } = await supabase
    .from('communication_events')
    .delete()
    .in('status', ['sent', 'failed', 'cancelled'])
    .lt('processed_at', cutoffDate.toISOString());

  if (error) {
    console.error('Error cleaning up emails:', error);
  } else {
    console.log(`Cleaned up old processed emails`);
  }
}

// Health check for email system
async function performHealthCheck(supabase: any) {
  console.log('Performing email system health check...');
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // Check queue health
  const { data: queueStats } = await supabase
    .from('communication_events')
    .select('status, priority')
    .gte('created_at', oneHourAgo.toISOString());

  const stats = {
    total: queueStats?.length || 0,
    queued: queueStats?.filter(e => e.status === 'queued').length || 0,
    processing: queueStats?.filter(e => e.status === 'processing').length || 0,
    sent: queueStats?.filter(e => e.status === 'sent').length || 0,
    failed: queueStats?.filter(e => e.status === 'failed').length || 0,
    highPriority: queueStats?.filter(e => e.priority === 'high').length || 0
  };

  // Check for stuck processing emails
  const { data: stuckEmails } = await supabase
    .from('communication_events')
    .select('id')
    .eq('status', 'processing')
    .lt('processing_started_at', new Date(now.getTime() - 10 * 60 * 1000).toISOString());

  if (stuckEmails && stuckEmails.length > 0) {
    console.warn(`Found ${stuckEmails.length} stuck emails, resetting to queued`);
    await supabase
      .from('communication_events')
      .update({ status: 'queued', processing_started_at: null })
      .in('id', stuckEmails.map(e => e.id));
  }

  // Log health status
  await supabase.from('email_system_health_logs').insert({
    queue_stats: stats,
    stuck_emails_found: stuckEmails?.length || 0,
    checked_at: now.toISOString()
  });

  return {
    healthy: stats.failed / (stats.total || 1) < 0.1, // Less than 10% failure rate
    stats,
    stuckEmailsFixed: stuckEmails?.length || 0
  };
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
    const { action, priority } = body;

    console.log(`Email queue processor processing: ${action}`);

    let result;

    switch (action) {
      case 'process_queue':
        result = await processEmailQueue(supabaseAdmin, priority);
        break;
        
      case 'process_all_priorities':
        const results = await Promise.all([
          processEmailQueue(supabaseAdmin, 'high'),
          processEmailQueue(supabaseAdmin, 'normal'),
          processEmailQueue(supabaseAdmin, 'low')
        ]);
        result = {
          high: results[0],
          normal: results[1],
          low: results[2],
          total: {
            processed: results.reduce((sum, r) => sum + r.processed, 0),
            successful: results.reduce((sum, r) => sum + r.successful, 0),
            failed: results.reduce((sum, r) => sum + r.failed, 0)
          }
        };
        break;
        
      case 'cleanup':
        await cleanupProcessedEmails(supabaseAdmin);
        result = { message: 'Cleanup completed' };
        break;
        
      case 'health_check':
        result = await performHealthCheck(supabaseAdmin);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        result,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email queue processor error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Email queue processing failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
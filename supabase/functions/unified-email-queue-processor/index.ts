// Unified Email Queue Processor - Production Ready with Circuit Breaker
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Circuit breaker configuration
const CIRCUIT_BREAKER = {
  authFailureThreshold: 3,    // Stop after 3 consecutive auth failures
  timeWindow: 300000,         // 5 minutes
  recoveryTime: 600000        // 10 minutes before retry
};

let circuitBreakerState = {
  isOpen: false,
  consecutiveAuthFailures: 0,
  lastAuthFailure: 0,
  lastCheck: 0
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check circuit breaker before processing
    const circuitCheck = await checkCircuitBreaker(supabase);
    if (!circuitCheck.canProcess) {
      console.log(`🚫 Circuit breaker OPEN: ${circuitCheck.reason}`);
      
      return new Response(JSON.stringify({
        success: false,
        processed: 0,
        failed: 0,
        skipped: 0,
        circuitBreaker: {
          state: 'open',
          reason: circuitCheck.reason,
          nextRetry: new Date(circuitCheck.nextRetry).toISOString()
        },
        message: 'Email processing suspended due to authentication failures'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503
      });
    }

    const requestBody = await req.json().catch(() => ({}));
    
    // Handle health check requests
    if (requestBody.healthcheck || requestBody.dry_run || requestBody.test_mode) {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'unified-email-queue-processor',
        timestamp: new Date().toISOString(),
        circuitBreaker: circuitBreakerState.isOpen ? 'open' : 'closed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const batchSize = requestBody.batchSize || 50;
    const priority = requestBody.priority || 'all';

    console.log('🚀 Starting unified email queue processing...');
    console.log(`📧 Batch size: ${batchSize}, Priority: ${priority}`);

    // Get queued emails based on priority and retry logic
    // USE ATOMIC LOCKING to prevent race conditions
    let { data: queuedEmails, error: fetchError } = await supabase
      .rpc('fetch_and_lock_communication_events', { p_limit: batchSize });

    // Fallback to regular select if RPC fails (e.g. not deployed yet)
    if (fetchError) {
      console.warn('⚠️ Atomic locking failed, falling back to standard select:', fetchError.message);
      
      let query = supabase
        .from('communication_events')
        .select('*')
        .eq('status', 'queued')
        .lt('retry_count', 3)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(batchSize);

      if (priority !== 'all') {
        query = query.eq('priority', priority);
      }
      
      const { data: fallbackEmails, error: fallbackError } = await query;
      if (fallbackError) throw fallbackError;
      
      // Manually mark as processing to minimize race window
      if (fallbackEmails && fallbackEmails.length > 0) {
        const ids = fallbackEmails.map((e: any) => e.id);
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .in('id', ids);
          
        queuedEmails = fallbackEmails;
        // Clear the error since we recovered
        fetchError = null;
      } else {
        queuedEmails = [];
        fetchError = null;
      }
    }

    if (fetchError) {
       throw fetchError;
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      console.log('✅ No queued emails found');
      return new Response(
        JSON.stringify({ 
          message: 'No queued emails to process', 
          processed: 0,
          failed: 0,
          status: 'success'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 Found ${queuedEmails.length} queued emails to process`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];
    let authFailureDetected = false;

    // Process each email
    for (const email of queuedEmails) {
      try {
        console.log(`🔄 Processing email ${email.id} for ${email.recipient_email}`);
        
        // Mark as processing - SKIPPED because fetch_and_lock_communication_events already does this!
        // But we update the timestamp to be precise
        /*
        await supabase
          .from('communication_events')
          .update({ 
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);
        */

        // Send via unified SMTP sender
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
          body: {
            to: email.recipient_email,
            subject: email.subject || undefined,
            html: email.html_content || undefined,
            text: email.text_content || undefined,
            templateKey: email.template_key,
            variables: email.template_variables || email.variables || {},
            emailType: email.email_type || 'transactional',
            priority: email.priority || 'normal'
          }
        });

        if (emailError || !emailResult?.success) {
          const errorMessage = emailError?.message || emailResult?.error || 'Unknown error';
          
          // Check for authentication errors
          if (errorMessage.includes('535') || errorMessage.includes('authentication')) {
            authFailureDetected = true;
            console.error(`🔒 AUTH FAILURE detected for email ${email.id}: ${errorMessage}`);
          }
          
          console.error(`❌ Failed to send email ${email.id}:`, errorMessage);
          
          // Update status to failed with retry logic
          await supabase
            .from('communication_events')
            .update({ 
              status: 'failed',
              error_message: errorMessage,
              last_error: errorMessage,
              retry_count: (email.retry_count || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);

          failureCount++;
          results.push({
            eventId: email.id,
            recipient: email.recipient_email,
            status: 'failed',
            error: errorMessage
          });
          
          continue;
        }

        // Update status to sent on success
        await supabase
          .from('communication_events')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            external_id: emailResult?.messageId,
            processing_time_ms: Date.now() - new Date(email.processing_started_at || email.updated_at).getTime(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        console.log(`✅ Email sent successfully: ${email.id} -> ${email.recipient_email}`);
        
        successCount++;
        results.push({
          eventId: email.id,
          recipient: email.recipient_email,
          status: 'sent',
          messageId: emailResult?.messageId
        });

        // Rate limiting - small delay between emails for production stability
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (eventError) {
        console.error(`❌ Error processing email ${email.id}:`, eventError);
        
        // Update with error
        await supabase
          .from('communication_events')
          .update({ 
            status: 'failed',
            error_message: eventError.message,
            last_error: eventError.message,
            retry_count: (email.retry_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        failureCount++;
        results.push({
          eventId: email.id,
          recipient: email.recipient_email,
          status: 'error',
          error: eventError.message
        });
      }
    }

    // Update circuit breaker state
    if (authFailureDetected) {
      await updateCircuitBreakerState(supabase, true);
    } else if (successCount > 0) {
      await updateCircuitBreakerState(supabase, false);
    }

    // Log comprehensive results
    console.log(`=== Email Queue Processing Complete ===`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    // Log to audit for monitoring
    await supabase.from('audit_logs').insert({
      action: 'unified_email_queue_processing',
      category: 'Email Processing',
      message: `Processed ${queuedEmails.length} emails: ${successCount} sent, ${failureCount} failed`,
      new_values: {
        total_processed: queuedEmails.length,
        successful: successCount,
        failed: failureCount,
        batch_size: batchSize,
        priority_filter: priority,
        processing_time: new Date().toISOString(),
        production_mode: true
      }
    });

    // Alert if failure rate is high
    const failureRate = failureCount / queuedEmails.length;
    if (failureRate > 0.2 && queuedEmails.length > 5) {
      console.warn(`⚠️ HIGH FAILURE RATE: ${(failureRate * 100).toFixed(1)}% of emails failed`);
      
      await supabase.from('audit_logs').insert({
        action: 'email_queue_high_failure_rate',
        category: 'System Alert',
        message: `Critical: Email queue failure rate is ${(failureRate * 100).toFixed(1)}%`,
        new_values: {
          failure_rate: failureRate,
          total_processed: queuedEmails.length,
          failed_count: failureCount,
          alert_level: 'critical'
        }
      });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Email queue processing completed',
        total_events: queuedEmails.length,
        successful: successCount,
        failed: failureCount,
        failure_rate: failureRate,
        status: 'completed',
        production_ready: true,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== Unified Email Queue Processor Error ===');
    console.error('Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'error',
        timestamp: new Date().toISOString(),
        production_error: true
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Check circuit breaker state
async function checkCircuitBreaker(supabase: any): Promise<{
  canProcess: boolean;
  reason?: string;
  nextRetry?: number;
}> {
  const now = Date.now();
  
  // Check if circuit breaker should be reset
  if (circuitBreakerState.isOpen && 
      now - circuitBreakerState.lastAuthFailure > CIRCUIT_BREAKER.recoveryTime) {
    console.log('🔄 Circuit breaker recovery time reached, resetting state');
    circuitBreakerState.isOpen = false;
    circuitBreakerState.consecutiveAuthFailures = 0;
  }

  // Load recent auth failures from database if needed
  if (now - circuitBreakerState.lastCheck > 60000) { // Check every minute
    try {
      const { data: recentFailures } = await supabase
        .from('smtp_delivery_logs')
        .select('created_at, error_message')
        .eq('delivery_status', 'failed')
        .gte('created_at', new Date(now - CIRCUIT_BREAKER.timeWindow).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      let consecutiveAuthFailures = 0;
      if (recentFailures) {
        for (const failure of recentFailures) {
          if (failure.error_message?.includes('535') || 
              failure.error_message?.includes('authentication')) {
            consecutiveAuthFailures++;
          } else {
            break; // Non-auth error breaks the consecutive count
          }
        }
      }

      circuitBreakerState.consecutiveAuthFailures = consecutiveAuthFailures;
      circuitBreakerState.lastCheck = now;

      if (consecutiveAuthFailures >= CIRCUIT_BREAKER.authFailureThreshold) {
        circuitBreakerState.isOpen = true;
        circuitBreakerState.lastAuthFailure = now;
      }
    } catch (error) {
      console.warn('Failed to check circuit breaker state:', error.message);
    }
  }

  if (circuitBreakerState.isOpen) {
    return {
      canProcess: false,
      reason: `${circuitBreakerState.consecutiveAuthFailures} consecutive auth failures`,
      nextRetry: circuitBreakerState.lastAuthFailure + CIRCUIT_BREAKER.recoveryTime
    };
  }

  return { canProcess: true };
}

// Update circuit breaker state
async function updateCircuitBreakerState(supabase: any, authFailure: boolean): Promise<void> {
  const now = Date.now();
  
  if (authFailure) {
    circuitBreakerState.consecutiveAuthFailures++;
    circuitBreakerState.lastAuthFailure = now;
    
    if (circuitBreakerState.consecutiveAuthFailures >= CIRCUIT_BREAKER.authFailureThreshold) {
      circuitBreakerState.isOpen = true;
      console.warn(`🚫 Circuit breaker OPENED after ${circuitBreakerState.consecutiveAuthFailures} auth failures`);
    }
  } else {
    // Reset on successful send
    if (circuitBreakerState.consecutiveAuthFailures > 0) {
      console.log(`🔄 Resetting circuit breaker after successful send`);
      circuitBreakerState.consecutiveAuthFailures = 0;
      circuitBreakerState.isOpen = false;
    }
  }
  
  circuitBreakerState.lastCheck = now;
}
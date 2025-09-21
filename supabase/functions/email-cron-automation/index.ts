import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CronTask {
  name: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

// CRON tasks configuration
const CRON_TASKS: Record<string, CronTask> = {
  email_queue_processing: {
    name: 'Process Email Queue',
    schedule: '*/5 * * * *', // Every 5 minutes
    enabled: true
  },
  automation_queue_processing: {
    name: 'Process Automation Queue',
    schedule: '*/2 * * * *', // Every 2 minutes
    enabled: true
  },
  cart_abandonment_detection: {
    name: 'Detect Cart Abandonments',
    schedule: '0 */1 * * *', // Every hour
    enabled: true
  },
  inactive_customer_detection: {
    name: 'Detect Inactive Customers',
    schedule: '0 8 * * *', // Daily at 8 AM
    enabled: true
  },
  email_system_health: {
    name: 'Email System Health Check',
    schedule: '*/10 * * * *', // Every 10 minutes
    enabled: true
  },
  email_cleanup: {
    name: 'Email System Cleanup',
    schedule: '0 2 * * *', // Daily at 2 AM
    enabled: true
  },
  bounce_processing: {
    name: 'Process Email Bounces',
    schedule: '*/15 * * * *', // Every 15 minutes
    enabled: true
  },
  weekly_digest: {
    name: 'Weekly Email Digest',
    schedule: '0 9 * * 1', // Monday at 9 AM
    enabled: true
  }
};

async function executeEmailQueueProcessing(supabase: any) {
  console.log('🔄 Executing: Email Queue Processing');
  
  try {
    // Call our new notification processor
    const { data, error } = await supabase.functions.invoke('process-email-notifications');

    if (error) throw error;
    
    console.log('✅ Email queue processing completed:', data);
    
    // Clean up old processed notifications (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await supabase
      .from('order_status_notifications')
      .delete()
      .not('processed_at', 'is', null)
      .lt('processed_at', sevenDaysAgo.toISOString());
      
    return { success: true, data };
  } catch (error) {
    console.error('❌ Email queue processing failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeAutomationQueueProcessing(supabase: any) {
  console.log('🔄 Executing: Automation Queue Processing');
  
  try {
    const { data, error } = await supabase.functions.invoke('email-automation-engine', {
      body: { action: 'process_queue' }
    });

    if (error) throw error;
    
    console.log('✅ Automation queue processing completed:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Automation queue processing failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeCartAbandonmentDetection(supabase: any) {
  console.log('🔄 Executing: Cart Abandonment Detection');
  
  try {
    const { data, error } = await supabase.functions.invoke('email-trigger-manager', {
      body: { action: 'detect_abandonments' }
    });

    if (error) throw error;
    
    console.log('✅ Cart abandonment detection completed:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Cart abandonment detection failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeInactiveCustomerDetection(supabase: any) {
  console.log('🔄 Executing: Inactive Customer Detection');
  
  try {
    const { data, error } = await supabase.functions.invoke('email-trigger-manager', {
      body: { action: 'detect_inactive' }
    });

    if (error) throw error;
    
    console.log('✅ Inactive customer detection completed:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Inactive customer detection failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeEmailSystemHealth(supabase: any) {
  console.log('🔄 Executing: Email System Health Check');
  
  try {
    const { data, error } = await supabase.functions.invoke('email-queue-processor', {
      body: { action: 'health_check' }
    });

    if (error) throw error;
    
    // Check SMTP health
    const { data: smtpHealth, error: smtpError } = await supabase.functions.invoke('smtp-health-monitor', {
      body: { action: 'health_check' }
    });

    if (smtpError) {
      console.warn('SMTP health check failed:', smtpError);
    }
    
    console.log('✅ Email system health check completed:', { queue: data, smtp: smtpHealth });
    return { success: true, data: { queue: data, smtp: smtpHealth } };
  } catch (error) {
    console.error('❌ Email system health check failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeEmailCleanup(supabase: any) {
  console.log('🔄 Executing: Email System Cleanup');
  
  try {
    const { data, error } = await supabase.functions.invoke('email-queue-processor', {
      body: { action: 'cleanup' }
    });

    if (error) throw error;
    
    // Additional cleanup tasks
    await cleanupOldLogs(supabase);
    await cleanupProcessedAutomations(supabase);
    
    console.log('✅ Email system cleanup completed:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Email system cleanup failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeBounceProcessing(supabase: any) {
  console.log('🔄 Executing: Bounce Processing');
  
  try {
    // Process bounces and complaints
    const { data: bounces, error: bounceError } = await supabase
      .from('email_bounce_tracking')
      .select('*')
      .is('processed_at', null)
      .limit(100);

    if (bounceError) throw bounceError;

    let processed = 0;
    for (const bounce of bounces || []) {
      if (bounce.bounce_type === 'hard' || bounce.complaint_type === 'spam') {
        // Add to suppression list
        await supabase.from('email_suppression_list').upsert({
          email: bounce.email_address,
          reason: bounce.bounce_type === 'hard' ? 'hard_bounce' : 'spam_complaint',
          suppressed_at: new Date().toISOString(),
          is_active: true
        });
        
        // Mark bounce as suppressed
        await supabase
          .from('email_bounce_tracking')
          .update({ 
            suppressed_at: new Date().toISOString(),
            processed_at: new Date().toISOString()
          })
          .eq('id', bounce.id);
      } else {
        // Mark as processed
        await supabase
          .from('email_bounce_tracking')
          .update({ processed_at: new Date().toISOString() })
          .eq('id', bounce.id);
      }
      processed++;
    }
    
    console.log(`✅ Bounce processing completed: ${processed} bounces processed`);
    return { success: true, data: { processed } };
  } catch (error) {
    console.error('❌ Bounce processing failed:', error);
    return { success: false, error: error.message };
  }
}

async function executeWeeklyDigest(supabase: any) {
  console.log('🔄 Executing: Weekly Email Digest');
  
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get email stats for the week
    const { data: weeklyStats } = await supabase
      .from('communication_events')
      .select('status, template_key')
      .gte('created_at', weekAgo.toISOString());

    const stats = {
      total: weeklyStats?.length || 0,
      sent: weeklyStats?.filter(e => e.status === 'sent').length || 0,
      failed: weeklyStats?.filter(e => e.status === 'failed').length || 0,
      queued: weeklyStats?.filter(e => e.status === 'queued').length || 0
    };
    
    // Send digest to admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);

    for (const admin of admins || []) {
      await supabase.functions.invoke('supabase-auth-email-sender', {
        body: {
          templateId: 'weekly_email_digest',
          to: admin.email,
          variables: {
            weekStart: weekAgo.toLocaleDateString(),
            weekEnd: now.toLocaleDateString(),
            ...stats,
            successRate: stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : '0'
          },
          emailType: 'system'
        }
      });
    }
    
    console.log('✅ Weekly digest sent to admins:', stats);
    return { success: true, data: stats };
  } catch (error) {
    console.error('❌ Weekly digest failed:', error);
    return { success: false, error: error.message };
  }
}

async function cleanupOldLogs(supabase: any) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  // Clean up old automation logs
  await supabase
    .from('email_automation_logs')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString());
    
  // Clean up old trigger logs
  await supabase
    .from('email_trigger_logs')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString());
    
  // Clean up old batch logs
  await supabase
    .from('email_batch_logs')
    .delete()
    .lt('processed_at', thirtyDaysAgo.toISOString());
}

async function cleanupProcessedAutomations(supabase: any) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  // Clean up completed automation queue items
  await supabase
    .from('email_automation_queue')
    .delete()
    .eq('status', 'completed')
    .lt('processed_at', sevenDaysAgo.toISOString());
}

// CRON task executors
const TASK_EXECUTORS: Record<string, (supabase: any) => Promise<any>> = {
  email_queue_processing: executeEmailQueueProcessing,
  automation_queue_processing: executeAutomationQueueProcessing,
  cart_abandonment_detection: executeCartAbandonmentDetection,
  inactive_customer_detection: executeInactiveCustomerDetection,
  email_system_health: executeEmailSystemHealth,
  email_cleanup: executeEmailCleanup,
  bounce_processing: executeBounceProcessing,
  weekly_digest: executeWeeklyDigest
};

async function executeCronTask(supabase: any, taskName: string) {
  const task = CRON_TASKS[taskName];
  if (!task || !task.enabled) {
    console.log(`Task ${taskName} is disabled or not found`);
    return { success: false, message: 'Task disabled or not found' };
  }

  const executor = TASK_EXECUTORS[taskName];
  if (!executor) {
    console.error(`No executor found for task: ${taskName}`);
    return { success: false, message: 'No executor found' };
  }

  const startTime = Date.now();
  
  try {
    // Log task start
    await supabase.from('cron_execution_logs').insert({
      task_name: taskName,
      status: 'running',
      started_at: new Date().toISOString()
    });

    const result = await executor(supabase);
    const duration = Date.now() - startTime;

    // Log task completion
    await supabase.from('cron_execution_logs')
      .update({
        status: result.success ? 'completed' : 'failed',
        duration_ms: duration,
        result_data: result.data || null,
        error_message: result.error || null,
        completed_at: new Date().toISOString()
      })
      .eq('task_name', taskName)
      .eq('started_at', new Date().toISOString());

    console.log(`✅ Task ${taskName} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log task error
    await supabase.from('cron_execution_logs')
      .update({
        status: 'failed',
        duration_ms: duration,
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('task_name', taskName)
      .eq('started_at', new Date().toISOString());

    console.error(`❌ Task ${taskName} failed after ${duration}ms:`, error);
    return { success: false, error: error.message };
  }
}

async function executeAllTasks(supabase: any) {
  console.log('🚀 Executing all enabled CRON tasks...');
  
  const results: Record<string, any> = {};
  const taskNames = Object.keys(CRON_TASKS).filter(name => CRON_TASKS[name].enabled);
  
  // Execute tasks in batches to avoid overwhelming the system
  const batchSize = 3;
  for (let i = 0; i < taskNames.length; i += batchSize) {
    const batch = taskNames.slice(i, i + batchSize);
    const batchPromises = batch.map(taskName => 
      executeCronTask(supabase, taskName).then(result => ({ taskName, result }))
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach(promiseResult => {
      if (promiseResult.status === 'fulfilled') {
        const { taskName, result } = promiseResult.value;
        results[taskName] = result;
      } else {
        console.error('Batch execution error:', promiseResult.reason);
      }
    });
    
    // Brief pause between batches
    if (i + batchSize < taskNames.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

Deno.serve(async (req) => {
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
    const { action, taskName } = body;

    console.log(`🕐 Email CRON processing: ${action}`);

    let result;

    switch (action) {
      case 'execute_task':
        if (!taskName) {
          throw new Error('Task name is required');
        }
        result = await executeCronTask(supabaseAdmin, taskName);
        break;
        
      case 'execute_all':
        result = await executeAllTasks(supabaseAdmin);
        break;
        
      case 'status':
        result = {
          tasks: CRON_TASKS,
          timestamp: new Date().toISOString()
        };
        break;
        
      default:
        // Default behavior - execute all tasks (for scheduled CRON)
        result = await executeAllTasks(supabaseAdmin);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: action || 'execute_all',
        result,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email CRON automation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Email CRON automation failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
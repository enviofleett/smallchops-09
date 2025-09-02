import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  action: 'send' | 'cleanup' | 'health_check' | 'get_stats';
  email_data?: {
    recipient_email: string;
    template_key: string;
    variables?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
    event_type?: string;
  };
  cleanup_options?: {
    days_old?: number;
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestData: EmailRequest = await req.json();
    const { action } = requestData;

    // Security: Verify admin access for sensitive operations
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      await logSecurityEvent(supabase, 'unauthorized_email_access', '', 'email-service-core', {
        error: authError?.message,
        ip: getClientIP(req)
      });

      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user is admin for sensitive operations
    const isAdminOperation = ['cleanup', 'get_stats'].includes(action);
    if (isAdminOperation) {
      const { data: isAdmin } = await supabase.rpc('is_admin');
      if (!isAdmin) {
        await logSecurityEvent(supabase, 'non_admin_email_operation', user.email || '', 'email-service-core', {
          action,
          user_id: user.id,
          ip: getClientIP(req)
        });

        return new Response(
          JSON.stringify({ error: 'Admin privileges required' }),
          { 
            status: 403, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Route to appropriate handler
    switch (action) {
      case 'send':
        return await handleEmailSend(supabase, requestData.email_data!, user);
      case 'cleanup':
        return await handleEmailCleanup(supabase, requestData.cleanup_options);
      case 'health_check':
        return await handleHealthCheck(supabase);
      case 'get_stats':
        return await handleGetStats(supabase);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
    }

  } catch (error: any) {
    console.error('Email service error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleEmailSend(supabase: any, emailData: any, user: any) {
  const { recipient_email, template_key, variables, priority, event_type } = emailData;

  // Input validation
  if (!recipient_email || !template_key) {
    return new Response(
      JSON.stringify({ error: 'recipient_email and template_key are required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipient_email)) {
    return new Response(
      JSON.stringify({ error: 'Invalid email address' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Check rate limits
  const { data: rateLimitCheck } = await supabase.rpc('check_email_rate_limit', {
    email_address: recipient_email.toLowerCase(),
    time_window_minutes: 60
  });

  if (!rateLimitCheck?.allowed) {
    await logSecurityEvent(supabase, 'email_rate_limit_exceeded', recipient_email, 'email-service-core', {
      current_count: rateLimitCheck?.current_count,
      limit: rateLimitCheck?.limit,
      user_id: user.id
    });

    return new Response(
      JSON.stringify({ 
        error: 'Rate limit exceeded',
        details: rateLimitCheck 
      }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Check if email is suppressed
  const { data: isSuppressed } = await supabase.rpc('is_email_suppressed', {
    email_address: recipient_email.toLowerCase()
  });

  if (isSuppressed) {
    await logSecurityEvent(supabase, 'email_to_suppressed_address', recipient_email, 'email-service-core', {
      user_id: user.id
    });

    return new Response(
      JSON.stringify({ 
        error: 'Email address is suppressed',
        success: false
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Queue the email
  const { data, error } = await supabase
    .from('communication_events')
    .insert({
      event_type: event_type || template_key,
      template_key,
      recipient_email: recipient_email.toLowerCase(),
      variables: variables || {},
      priority: priority || 'normal',
      status: 'queued',
      email_type: 'transactional'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to queue email:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to queue email',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Log successful queue
  await logSecurityEvent(supabase, 'email_queued_successfully', recipient_email, 'email-service-core', {
    event_id: data.id,
    template_key,
    user_id: user.id
  });

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Email queued successfully',
      event_id: data.id
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function handleEmailCleanup(supabase: any, options: any) {
  const daysOld = options?.days_old || 30;

  // Call the secure admin cleanup function
  const { data, error } = await supabase.rpc('admin_email_cleanup', {
    p_days_old: daysOld
  });

  if (error) {
    console.error('Email cleanup failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Email cleanup failed',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Email cleanup completed',
      results: data
    }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

async function handleHealthCheck(supabase: any) {
  try {
    // Check database connectivity
    const { data: dbCheck, error: dbError } = await supabase
      .from('communication_events')
      .select('count')
      .limit(1);

    if (dbError) {
      throw new Error(`Database check failed: ${dbError.message}`);
    }

    // Check SMTP configuration
    const { data: smtpCheck } = await supabase.functions.invoke('unified-smtp-sender', {
      body: { healthcheck: true, check: 'smtp' }
    });

    // Get basic stats
    const { data: stats } = await supabase
      .from('communication_events')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const statusCounts = (stats || []).reduce((acc: any, event: any) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({
        success: true,
        health: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
          smtp: smtpCheck?.smtpCheck?.configured ? 'healthy' : 'warning',
        },
        stats: {
          last_24h: statusCounts
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        health: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleGetStats(supabase: any) {
  try {
    // Get comprehensive email statistics
    const { data: events } = await supabase
      .from('communication_events')
      .select('status, created_at, priority, event_type')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    const stats = {
      total: events?.length || 0,
      by_status: {},
      by_priority: {},
      by_event_type: {},
      last_7_days: {}
    };

    events?.forEach((event: any) => {
      // Count by status
      stats.by_status[event.status] = (stats.by_status[event.status] || 0) + 1;
      
      // Count by priority  
      stats.by_priority[event.priority] = (stats.by_priority[event.priority] || 0) + 1;
      
      // Count by event type
      stats.by_event_type[event.event_type] = (stats.by_event_type[event.event_type] || 0) + 1;
      
      // Count by day
      const day = event.created_at.split('T')[0];
      stats.last_7_days[day] = (stats.last_7_days[day] || 0) + 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        generated_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('Stats generation failed:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate stats',
        details: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}

async function logSecurityEvent(supabase: any, eventType: string, email: string, functionName: string, details: any = {}) {
  try {
    await supabase.rpc('log_email_security_event', {
      p_event_type: eventType,
      p_email_address: email,
      p_function_name: functionName,
      p_details: details
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for') || 
         req.headers.get('x-real-ip') || 
         'unknown';
}
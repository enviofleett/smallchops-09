import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Circuit Breaker and Alert Infrastructure
class CircuitBreaker {
  private state = 'closed'; // closed, open, half-open
  private failureCount = 0;
  private lastFailureTime?: number;
  private serviceName: string;
  private failureThreshold: number;
  private timeoutMs: number;

  constructor(serviceName: string, failureThreshold = 5, timeoutMs = 60000) {
    this.serviceName = serviceName;
    this.failureThreshold = failureThreshold;
    this.timeoutMs = timeoutMs;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime > this.timeoutMs;
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.error(`🚨 Circuit breaker OPENED for ${this.serviceName}`);
    }
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      serviceName: this.serviceName
    };
  }
}

// Alert System
async function sendAlert(alertType: string, message: string, severity = 'warning') {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL') || Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    console.log(`📢 ALERT [${severity.toUpperCase()}] ${alertType}: ${message}`);
    return;
  }
  
  const colors = {
    'critical': '#FF0000',
    'warning': '#FFA500', 
    'info': '#00FF00'
  };
  
  const payload = {
    username: 'Order System Monitor',
    icon_emoji: ':rotating_light:',
    attachments: [{
      color: colors[severity] || '#FFA500',
      title: `🚨 ${alertType}`,
      text: message,
      fields: [
        {
          title: 'Severity',
          value: severity.toUpperCase(),
          short: true
        },
        {
          title: 'Timestamp',
          value: new Date().toISOString(),
          short: true
        }
      ]
    }]
  };
  
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`✅ Alert sent: ${alertType}`);
  } catch (error) {
    console.error('Failed to send alert:', error.message);
  }
}

// Import shared CORS with inline fallback for production stability
let getCorsHeaders;
let handleCorsPreflightResponse;
try {
  const corsModule = await import('../_shared/cors.ts');
  getCorsHeaders = corsModule.getCorsHeaders;
  handleCorsPreflightResponse = corsModule.handleCorsPreflightResponse;
  console.log('✅ Loaded shared CORS module');
} catch (error) {
  console.warn('⚠️ Failed to load shared CORS, using inline fallback:', error);
  const FALLBACK_ALLOWED_ORIGINS = [
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'https://oknnklksdiqaifhxaccs.lovable.app',
    'https://id-preview--7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovable.app',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.sandbox.lovable.dev',
    'http://localhost:3000',
    'http://localhost:5173'
  ];
  const DEV_PATTERNS = [
    /^https:\/\/.*\.lovable\.app$/,
    /^https:\/\/.*\.sandbox\.lovable\.dev$/,
    /^http:\/\/localhost:\d+$/
  ];
  getCorsHeaders = (origin)=>{
    const baseHeaders = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Credentials': 'false'
    };
    if (!origin || !FALLBACK_ALLOWED_ORIGINS.includes(origin) && !DEV_PATTERNS.some((pattern)=>pattern.test(origin))) {
      return {
        ...baseHeaders,
        'Access-Control-Allow-Origin': '*'
      };
    }
    return {
      ...baseHeaders,
      'Access-Control-Allow-Origin': origin,
      'Vary': 'Origin'
    };
  };
  handleCorsPreflightResponse = (origin)=>{
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin)
    });
  };
}

const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// Initialize circuit breakers for different services
const circuitBreakers = {
  database: new CircuitBreaker('database_operations', 3, 30000),
  orderUpdate: new CircuitBreaker('order_update_operations', 5, 10000),
  webhooks: new CircuitBreaker('webhook_delivery', 2, 5000)
};

// Enhanced system health check function
async function checkSystemHealth() {
  const checks = [];
  let overallHealth = true;
  
  // Database connectivity check
  try {
    const start = Date.now();
    const { data, error } = await supabaseClient
      .from('orders')
      .select('count')
      .limit(1);
    
    checks.push({
      name: 'database_connectivity',
      status: error ? 'fail' : 'pass',
      responseTime: Date.now() - start,
      error: error?.message
    });
    
    if (error) overallHealth = false;
  } catch (e) {
    checks.push({
      name: 'database_connectivity',
      status: 'fail',
      error: e.message
    });
    overallHealth = false;
  }
  
  // Enhanced system health metrics including 409 conflicts
  try {
    const { data: healthMetrics, error } = await supabaseClient.rpc('get_enhanced_system_health_metrics');
    
    if (error) throw error;
    
    const metrics = healthMetrics || {};
    const conflictData = metrics.conflict_resolution || {};
    const conflictRate = conflictData.conflict_rate_percent || 0;
    const avgResolutionTime = conflictData.avg_resolution_time_ms || 0;
    
    checks.push({
      name: 'conflict_resolution_health',
      status: conflictRate > 15 ? 'fail' : conflictRate > 5 ? 'warn' : 'pass',
      conflictRate: `${conflictRate}%`,
      avgResolutionTime: `${avgResolutionTime}ms`,
      details: conflictData
    });
    
    if (conflictRate > 15) {
      overallHealth = false;
      // Send critical alert for high conflict rate
      await sendAlert(
        'High 409 Conflict Rate', 
        `Conflict resolution rate at ${conflictRate}% exceeds critical threshold of 15%`, 
        'critical'
      );
    }
  } catch (e) {
    checks.push({
      name: 'conflict_resolution_health',
      status: 'fail',
      error: e.message
    });
  }
  
  // Recent error rate check from order_update_metrics
  try {
    const { data: recentMetrics, error } = await supabaseClient
      .from('order_update_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 300000).toISOString()) // 5 minutes
      .eq('status', 'error');
    
    const errorCount = recentMetrics?.length || 0;
    const errorRate = errorCount > 10 ? 'fail' : errorCount > 5 ? 'warn' : 'pass';
    
    checks.push({
      name: 'recent_error_rate',
      status: errorRate,
      recentErrors: errorCount,
      threshold: '10 errors per 5min'
    });
    
    if (errorRate === 'fail') {
      overallHealth = false;
      // Send alert for high error rate
      await sendAlert(
        'High Error Rate', 
        `${errorCount} errors in last 5 minutes exceeds threshold of 10`, 
        'critical'
      );
    }
  } catch (e) {
    checks.push({
      name: 'recent_error_rate',
      status: 'fail',
      error: e.message
    });
  }

  // Lock contention health check
  try {
    const { data: activeLocks, error } = await supabaseClient
      .from('order_update_locks')
      .select('*')
      .is('released_at', null)
      .gt('expires_at', new Date().toISOString());
    
    const lockCount = activeLocks?.length || 0;
    const lockStatus = lockCount > 20 ? 'fail' : lockCount > 10 ? 'warn' : 'pass';
    
    checks.push({
      name: 'lock_contention',
      status: lockStatus,
      activeLocks: lockCount,
      threshold: '20 active locks'
    });
    
    if (lockStatus === 'fail') {
      overallHealth = false;
      // Send alert for high lock contention
      await sendAlert(
        'High Lock Contention', 
        `${lockCount} active locks exceeds threshold of 20`, 
        'warning'
      );
    }
  } catch (e) {
    checks.push({
      name: 'lock_contention', 
      status: 'fail',
      error: e.message
    });
  }
  
  // Include circuit breaker status
  const circuitBreakerStatus = Object.entries(circuitBreakers).map(([name, breaker]) => ({
    name,
    ...breaker.getStatus()
  }));
  
  return {
    healthy: overallHealth,
    timestamp: new Date().toISOString(),
    checks,
    circuitBreakers: circuitBreakerStatus,
    version: '2.1.0',
    uptime: process.uptime?.() || 0
  };
}

// Template key mapping helper function
function getTemplateKey(status: string): string {
  const templateKeyMap: Record<string, string> = {
    'confirmed': 'order_confirmed',
    'preparing': 'order_preparing', 
    'ready': 'order_ready',
    'out_for_delivery': 'order_out_for_delivery',
    'delivered': 'order_delivered',
    'cancelled': 'order_cancelled'
  };
  return templateKeyMap[status] || 'order_status_update';
}
async function handleStatusChangeNotification(supabaseClient, orderId, order, newStatus, adminUserId = null) {
  try {
    // Add debugging for production issue tracking
    console.log(`📧 Notification handler called for order ${orderId}:`, {
      newStatus,
      adminUserId: adminUserId ? 'present' : 'null',
      customerEmail: order?.customer_email ? 'present' : 'missing'
    });
    const validStatuses = [
      'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
      'delivered', 'cancelled', 'refunded', 'completed', 'returned'
    ];
    if (!newStatus || typeof newStatus !== 'string' || !validStatuses.includes(newStatus.trim())) {
      console.error(`❌ CRITICAL: Invalid status in notification handler: "${newStatus}"`);
      return;
    }
    const sanitizedStatus = newStatus.trim();
    // PRODUCTION FIX: Enhanced collision-resistant dedupe key with microsecond precision + entropy
    const timestamp = Date.now();
    const microseconds = performance.now() * 1000;
    const entropy = Math.random().toString(36).substring(2, 10);
    const sessionId = adminUserId || 'system_admin'; // Enhanced with proper session tracking
    const dedupeKey = `${orderId}_${sanitizedStatus}_${timestamp}_${Math.floor(microseconds)}_${entropy}_${sessionId}`;

    let notificationInserted = false;
    if (order.customer_email) {
      // Try upsert (preferred) or fallback to insert-if-not-exists
        try {
        // Map status to proper template key
        const templateKeyMap = {
          'confirmed': 'order_confirmed',
          'preparing': 'order_preparing', 
          'ready': 'order_ready',
          'out_for_delivery': 'order_out_for_delivery',
          'delivered': 'order_delivered',
          'cancelled': 'order_cancelled'
        };
        const templateKey = templateKeyMap[sanitizedStatus] || 'order_status_update';
        
        const templateVars = {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          status: sanitizedStatus,
          status_display: sanitizedStatus.replace('_', ' ').replace(/\b\w/g, l=>l.toUpperCase()),
          total_amount: order.total_amount?.toLocaleString() || '0',
          order_date: new Date(order.order_time || new Date()).toLocaleDateString(),
          updated_at: new Date().toISOString()
        };

        // PRODUCTION FIX: Enhanced upsert with collision tracking
        const { error: upsertError } = await supabaseClient
          .from('communication_events')
          .upsert([{
            dedupe_key: dedupeKey,
            event_type: 'order_status_update',
            channel: 'email',
            recipient_email: order.customer_email,
            order_id: orderId,
            status: 'queued',
            template_key: templateKey,
            template_variables: templateVars,
            source: 'admin_update',
            priority: 'high',
            admin_session_id: adminUserId || 'system_admin',
            retry_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }], { onConflict: 'order_id,event_type,dedupe_key', ignoreDuplicates: true });

        if (upsertError) {
          if (upsertError.message.includes('duplicate key') || upsertError.message.includes('violates unique constraint')) {
            console.log('⚠️ Collision detected, logging for monitoring and continuing.');
            // Log collision for production monitoring
            try {
              await supabaseClient.from('communication_events_collision_log').insert({
                original_dedupe_key: dedupeKey,
                order_id: orderId,
                event_type: 'order_status_update',
                admin_session_ids: [adminUserId || 'system_admin'],
                resolution_strategy: 'ignore_duplicate'
              });
            } catch (logError) {
              console.warn('⚠️ Failed to log collision:', logError.message);
            }
            notificationInserted = false;
          } else {
            throw upsertError;
          }
        } else {
          notificationInserted = true;
          console.log('✅ Email notification queued successfully with enhanced dedupe.');
        }
      } catch (emailError) {
        console.log(`⚠️ Email notification upsert/insert failed: ${emailError.message}`);
      }
    }

    if (!notificationInserted && order.customer_phone) {
      // SMS Fallback: insert-if-not-exists using dedupe key
      try {
        const smsTemplateVars = {
          customer_name: order.customer_name || 'Customer',
          order_number: order.order_number,
          status: sanitizedStatus,
          message: `Hi ${order.customer_name || 'Customer'}! Your order ${order.order_number} status has been updated to: ${sanitizedStatus.replace('_', ' ').replace(/\b\w/g, l=>l.toUpperCase())}. Thank you for choosing us!`
        };

        const { error: smsInsertError } = await supabaseClient.from('communication_events').upsert([{
          dedupe_key: `${dedupeKey}_sms`,
          event_type: 'order_status_update',
          channel: 'sms',
          sms_phone: order.customer_phone,
          template_variables: smsTemplateVars,
          order_id: orderId,
          status: 'queued',
          priority: 'high',
          source: 'admin_update_sms',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

        if (smsInsertError) {
          if (smsInsertError.message.includes('duplicate key')) {
            console.log('⚠️ Duplicate SMS notification event, skipping insert.');
          } else {
            throw smsInsertError;
          }
        } else {
          console.log('✅ SMS fallback notification queued.');
        }
      } catch (smsError) {
        console.log(`⚠️ SMS fallback notification failed: ${smsError.message}`);
      }
    }

    // CRITICAL FIX: Wrap audit log insertion in try-catch
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'status_change_notification_attempted',
        category: 'Order Management',
        message: `Notification attempted for order ${order.order_number} status change to ${sanitizedStatus}`,
        entity_id: orderId,
        new_values: {
          old_status: order.status,
          new_status: sanitizedStatus,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          notification_channels_attempted: [
            order.customer_email ? 'email' : null,
            order.customer_phone ? 'sms' : null
          ].filter(Boolean)
        }
      }]);
    } catch (auditError) {
      console.error('⚠️ Audit log insertion failed (non-blocking):', auditError.message);
    }
  } catch (error) {
    console.error(`⚠️ Complete notification failure for order ${orderId}:`, error);
  }
}

serve(async (req)=>{
  const origin = req.headers.get('origin');
  
  // Generate correlation ID for request tracing
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🚀 Admin Orders Manager: ${req.method} request from origin: ${origin} [${correlationId}]`);
  
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling CORS preflight request');
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  // Health endpoint with circuit breaker status and alert checking
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/health')) {
    try {
      const healthData = await circuitBreakers.database.execute(async () => {
        return await checkSystemHealth();
      });
      
      // Check alert rules in background
      EdgeRuntime.waitUntil(
        supabaseClient.rpc('check_alert_rules').then(result => {
          console.log('Alert rules checked:', result.data);
        }).catch(err => {
          console.error('Failed to check alert rules:', err);
        })
      );
      
      return new Response(JSON.stringify(healthData), {
        status: healthData.healthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      await sendAlert('Health Check Failed', `Health endpoint error: ${error.message}`, 'critical');
      return new Response(JSON.stringify({
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Circuit breaker status endpoint
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/circuit-breaker-status')) {
    const status = Object.entries(circuitBreakers).map(([name, breaker]) => ({
      name,
      ...breaker.getStatus()
    }));
    
    return new Response(JSON.stringify({
      circuitBreakers: status,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  try {
    // Clean up expired locks
    const { data: lockCleanupResult } = await supabaseClient.rpc('cleanup_expired_locks');
    if (lockCleanupResult > 0) {
      console.log(`🧹 Cleaned up ${lockCleanupResult} expired locks [${correlationId}]`);
    }
    
    // Clean up stuck cache entries
    const { data: cacheCleanupResult } = await supabaseClient.rpc('cleanup_stuck_request_cache');
    if (cacheCleanupResult?.expired_cleaned > 0 || cacheCleanupResult?.stuck_processing_fixed > 0) {
      console.log(`🧹 Cache cleanup: ${cacheCleanupResult.expired_cleaned} expired, ${cacheCleanupResult.stuck_processing_fixed} stuck entries [${correlationId}]`);
    }
  } catch (cleanupError) {
    console.warn(`⚠️ Startup cleanup failed (non-blocking): ${cleanupError.message} [${correlationId}]`);
  }

  // Declare user variable at function scope so it's accessible throughout
  let user = null;

  // Enhanced Authentication with Production Error Handling
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🔒 Authentication failed: Missing or invalid authorization header');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Missing authentication token',
        errorCode: 'MISSING_AUTH_TOKEN'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Step 1: Verify JWT token
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    user = authData?.user; // Assign to the function-scoped user variable
    if (authError) {
      console.warn('🔒 Authentication failed: JWT verification error:', authError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: Invalid authentication token',
        errorCode: 'INVALID_JWT_TOKEN'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    if (!user?.id) {
      console.warn('🔒 Authentication failed: No user found in JWT token');
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: User not found',
        errorCode: 'USER_NOT_FOUND'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // Step 2: Check admin status with fallback authentication
    let isAdmin = false;
    let authMethod = 'unknown';

    try {
      // Primary: Check profiles table (using maybeSingle to handle missing profiles)
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('⚠️ Profile lookup failed:', profileError.message);
        // Continue to fallback authentication
      } else if (profile) {
        isAdmin = profile.role === 'admin' && profile.is_active;
        authMethod = 'profiles_table';
        console.log('✅ Profile authentication:', { userId: user.id, role: profile.role, isActive: profile.is_active });
      } else {
        console.warn('⚠️ No profile found for user:', user.id);
        // Continue to fallback authentication
      }

      // Fallback: Use database function if profile lookup failed or returned null
      if (!isAdmin) {
        console.log('🔄 Attempting fallback authentication using is_admin() function');
        const { data: adminCheck, error: adminError } = await supabaseClient.rpc('is_admin');
        
        if (adminError) {
          console.error('❌ Fallback admin check failed:', adminError.message);
        } else {
          isAdmin = Boolean(adminCheck);
          authMethod = 'is_admin_function';
          console.log('✅ Fallback authentication result:', { userId: user.id, isAdmin, method: authMethod });
        }
      }

    } catch (profileLookupError) {
      console.error('❌ Critical error during admin verification:', profileLookupError.message);
      // Log for monitoring but continue with final authorization check
    }

    // Step 3: Final authorization check
    if (!isAdmin) {
      console.warn('🚫 Admin access denied:', { 
        userId: user.id, 
        email: user.email,
        authMethod,
        timestamp: new Date().toISOString()
      });
      
      // Log security event
      try {
        await supabaseClient.from('audit_logs').insert([{
          action: 'admin_access_denied',
          category: 'Security Alert',
          message: `Admin access denied for user ${user.id} via ${authMethod}`,
          user_id: user.id,
          new_values: { 
            auth_method: authMethod, 
            user_email: user.email,
            timestamp: new Date().toISOString()
          }
        }]);
      } catch (auditError) {
        console.error('⚠️ Failed to log security event:', auditError.message);
      }

      return new Response(JSON.stringify({
        success: false,
        error: 'Forbidden: Admin access required',
        errorCode: 'INSUFFICIENT_PRIVILEGES'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      });
    }

    console.log('✅ Admin authentication successful:', { 
      userId: user.id, 
      email: user.email,
      authMethod,
      timestamp: new Date().toISOString()
    });

    // Log successful admin access
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'admin_access_granted',
        category: 'Admin Activity',
        message: `Admin access granted for user ${user.id} via ${authMethod}`,
        user_id: user.id,
        new_values: { 
          auth_method: authMethod,
          user_email: user.email,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (auditError) {
      console.error('⚠️ Failed to log admin access:', auditError.message);
    }

  } catch (authError) {
    console.error('❌ Critical authentication error:', {
      error: authError.message,
      stack: authError.stack,
      timestamp: new Date().toISOString()
    });

    // Log critical security event
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'authentication_system_error',
        category: 'Critical Security Alert',
        message: `Authentication system error: ${authError.message}`,
        new_values: { 
          error: authError.message,
          stack: authError.stack,
          timestamp: new Date().toISOString()
        }
      }]);
    } catch (auditError) {
      console.error('⚠️ Failed to log critical security event:', auditError.message);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Authentication system error',
      errorCode: 'AUTH_SYSTEM_ERROR'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }

  // Phase 2: Enhanced Health Endpoint
  if (req.method === 'GET' && req.url.includes('/health')) {
    console.log(`🏥 Health check requested [${correlationId}]`);
    try {
      const healthData = await checkSystemHealth();
      
      return new Response(JSON.stringify(healthData), {
        status: healthData.healthy ? 200 : 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (healthError) {
      console.error('❌ Health check failed:', healthError.message);
      return new Response(JSON.stringify({
        healthy: false,
        error: 'Health check system error',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Request Processing with Enhanced Error Handling
  try {
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (jsonError) {
      console.error('❌ Invalid JSON in request body:', jsonError.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body',
        errorCode: 'INVALID_JSON'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Validate required fields based on action
    const { action, orderId, updates, riderId, page, pageSize, status, searchQuery, startDate, endDate, orderIds, admin_user_id } = requestBody;
    
    // CRITICAL FIX: Create consistent adminUserId variable for all cases
    const adminUserId = admin_user_id || user.id;
    
    // Validate adminUserId is available
    if (!adminUserId) {
      console.error('❌ Missing admin user ID: admin_user_id not provided and user.id not available');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing admin user identification',
        errorCode: 'MISSING_ADMIN_USER_ID'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }
    
    if (!action || typeof action !== 'string') {
      console.error('❌ Missing or invalid action parameter:', action);
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing or invalid action parameter',
        errorCode: 'INVALID_ACTION'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log('📋 Processing admin request:', { 
      action, 
      orderId: orderId || 'N/A',
      timestamp: new Date().toISOString()
    });

    switch(action){
      case 'list': {
        const startTime = Date.now();
        
        console.log('Admin function: Listing orders', { page, pageSize, status, searchQuery, startDate, endDate });
        
        // Get orders with enhanced error handling and lock status
        let query = supabaseClient.from('orders').select(`
          *,
          order_items (*),
          order_delivery_schedule (*),
          delivery_zones (id, name, base_fee, is_active)
        `, { count: 'exact' });

        query = query.order('order_time', { ascending: false });

        if (status === 'confirmed') {
          query = query.eq('status', status).eq('payment_status', 'paid');
        } else if (status !== 'all') {
          query = query.eq('status', status);
        }

        if (searchQuery) {
          const searchString = `%${searchQuery}%`;
          query = query.or(`order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`);
        }

        if (startDate && endDate) {
          query = query.gte('order_time', startDate).lte('order_time', endDate);
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) {
          // Fallback: only select orders, fetch relations separately
          let fallbackQuery = supabaseClient.from('orders').select('*', { count: 'exact' });
          if (status === 'confirmed') {
            fallbackQuery = fallbackQuery.eq('status', status).eq('payment_status', 'paid');
          } else if (status !== 'all') {
            fallbackQuery = fallbackQuery.eq('status', status);
          }
          if (searchQuery) {
            const searchString = `%${searchQuery}%`;
            fallbackQuery = fallbackQuery.or(`order_number.ilike.${searchString},customer_name.ilike.${searchString},customer_phone.ilike.${searchString}`);
          }
          if (startDate && endDate) {
            fallbackQuery = fallbackQuery.gte('order_time', startDate).lte('order_time', endDate);
          }
          fallbackQuery = fallbackQuery.order('order_time', { ascending: false });
          const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery.range(from, to);
          if (fallbackError) {
            return new Response(JSON.stringify({
              success: false,
              error: fallbackError.message
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
          // Fetch related data separately
          const orderIds = fallbackData?.map(order=>order.id) || [];
          const [itemsResult, schedulesResult, zonesResult] = await Promise.all([
            supabaseClient.from('order_items').select('*').in('order_id', orderIds),
            supabaseClient.from('order_delivery_schedule').select('*').in('order_id', orderIds),
            supabaseClient.from('delivery_zones').select('id, name, base_fee, is_active')
          ]);
          const enrichedOrders = fallbackData?.map(order=>({
            ...order,
            order_items: itemsResult.data?.filter(item=>item.order_id === order.id) || [],
            order_delivery_schedule: schedulesResult.data?.filter(schedule=>schedule.order_id === order.id) || [],
            delivery_zones: zonesResult.data?.find(zone=>zone.id === order.delivery_zone_id) || null
          }));

          // Get lock information for fallback orders
          const ordersWithLockInfo = await Promise.all(
            enrichedOrders?.map(async (order) => {
              try {
                const { data: lockInfo } = await supabaseClient
                  .rpc('get_order_lock_info', { p_order_id: order.id });
                
                const lockData = lockInfo && lockInfo.length > 0 ? lockInfo[0] : {
                  is_locked: false,
                  locking_admin_id: null,
                  locking_admin_name: null,
                  locking_admin_avatar: null,
                  locking_admin_email: null,
                  lock_expires_at: null,
                  seconds_remaining: 0,
                  acquired_at: null
                };

                return {
                  ...order,
                  lock_info: lockData
                };
              } catch (error) {
                console.warn(`Failed to get lock info for order ${order.id}:`, error);
                return {
                  ...order,
                  lock_info: {
                    is_locked: false,
                    locking_admin_id: null,
                    locking_admin_name: null,
                    locking_admin_avatar: null,
                    locking_admin_email: null,
                    lock_expires_at: null,
                    seconds_remaining: 0,
                    acquired_at: null
                  }
                };
              }
            }) || []
          );

          return new Response(JSON.stringify({
            success: true,
            orders: ordersWithLockInfo,
            count: fallbackCount || 0,
            metadata: {
              request_time: Date.now() - startTime,
              correlation_id: correlationId
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get lock information for successful orders
        const ordersWithLockInfo = await Promise.all(
          data?.map(async (order) => {
            try {
              const { data: lockInfo } = await supabaseClient
                .rpc('get_order_lock_info', { p_order_id: order.id });
              
              const lockData = lockInfo && lockInfo.length > 0 ? lockInfo[0] : {
                is_locked: false,
                locking_admin_id: null,
                locking_admin_name: null,
                locking_admin_avatar: null,
                locking_admin_email: null,
                lock_expires_at: null,
                seconds_remaining: 0,
                acquired_at: null
              };

              return {
                ...order,
                lock_info: lockData
              };
            } catch (error) {
              console.warn(`Failed to get lock info for order ${order.id}:`, error);
              return {
                ...order,
                lock_info: {
                  is_locked: false,
                  locking_admin_id: null,
                  locking_admin_name: null,
                  locking_admin_avatar: null,
                  locking_admin_email: null,
                  lock_expires_at: null,
                  seconds_remaining: 0,
                  acquired_at: null
                }
              };
            }
          }) || []
        );

        return new Response(JSON.stringify({
          success: true,
          orders: ordersWithLockInfo,
          count: count || 0,
          metadata: {
            request_time: Date.now() - startTime,
            correlation_id: correlationId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'assign_rider': {
        console.log('🎯 Admin function: Assigning rider', riderId, 'to order', orderId);
        
        // Enhanced validation with detailed logging
        if (!riderId || riderId === 'null' || riderId === '' || riderId === undefined) {
          console.error('❌ Rider assignment failed: Invalid rider ID', { riderId, orderId });
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid rider ID: Rider ID cannot be null, undefined, or empty',
            errorCode: 'INVALID_RIDER_ID',
            context: { providedRiderId: riderId, orderId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Pre-validation: Check if rider exists and is active
        const { data: riderCheck, error: riderCheckError } = await supabaseClient
          .from('drivers')
          .select('id, name, is_active, vehicle_type')
          .eq('id', riderId)
          .single();

        if (riderCheckError || !riderCheck) {
          console.error('❌ Rider assignment failed: Rider not found', { 
            riderId, 
            orderId, 
            error: riderCheckError?.message 
          });
          
          // Get available active riders for suggestion
          const { data: activeRiders } = await supabaseClient
            .from('drivers')
            .select('id, name, vehicle_type')
            .eq('is_active', true)
            .limit(5);

          return new Response(JSON.stringify({
            success: false,
            error: `Rider not found with ID: ${riderId}`,
            errorCode: 'RIDER_NOT_FOUND',
            context: { 
              attemptedRiderId: riderId, 
              orderId,
              availableRiders: activeRiders || []
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        if (!riderCheck.is_active) {
          console.error('❌ Rider assignment failed: Rider is inactive', { 
            riderId: riderCheck.id, 
            riderName: riderCheck.name, 
            orderId 
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Rider "${riderCheck.name}" is currently inactive`,
            errorCode: 'RIDER_INACTIVE',
            context: { 
              riderId: riderCheck.id,
              riderName: riderCheck.name,
              orderId
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        const { data: orderCheck, error: orderCheckError } = await supabaseClient.from('orders').select('id, status, order_number').eq('id', orderId).single();
        if (orderCheckError || !orderCheck) {
          console.error('❌ Rider assignment failed: Order not found', { 
            orderId, 
            riderId, 
            error: orderCheckError?.message 
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`,
            errorCode: 'ORDER_NOT_FOUND',
            context: { orderId, riderId }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
        if (['confirmed', 'preparing', 'ready'].includes(orderCheck.status)) {
          console.log('🚀 Starting delivery for order', orderCheck.order_number, 'with rider', riderCheck.name);
          
          const { data: result, error: rpcError } = await supabaseClient.rpc('start_delivery', {
            p_order_id: orderId,
            p_rider_id: riderId
          });
          
          if (rpcError) {
            console.error('❌ start_delivery RPC failed:', { 
              orderId, 
              orderNumber: orderCheck.order_number,
              orderStatus: orderCheck.status,
              riderId: riderCheck.id, 
              riderName: riderCheck.name,
              riderActive: riderCheck.is_active,
              rpcError: rpcError.message,
              rpcCode: rpcError.code,
              rpcDetails: rpcError.details
            });
            
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to assign rider: ${rpcError.message}`,
              errorCode: 'START_DELIVERY_FAILED',
              context: {
                orderId,
                orderNumber: orderCheck.order_number,
                orderStatus: orderCheck.status,
                riderId: riderCheck.id,
                riderName: riderCheck.name,
                rpcError: rpcError.message,
                rpcCode: rpcError.code
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }
          
          const { data: updatedOrder } = await supabaseClient.from('orders').select(`
            *,
            order_items (*),
            order_delivery_schedule (*),
            delivery_zones (id, name, base_fee, is_active)
          `).eq('id', orderId).single();
          
          console.log('✅ Rider assignment successful:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            riderId: riderCheck.id, 
            riderName: riderCheck.name 
          });
          
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Order ${orderCheck.order_number} started for delivery with rider ${riderCheck.name}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else if (orderCheck.status === 'out_for_delivery') {
          console.log('🔄 Reassigning rider for order', orderCheck.order_number, 'from current rider to', riderCheck.name);
          
          const { data: result, error: rpcError } = await supabaseClient.rpc('reassign_order_rider', {
            p_order_id: orderId,
            p_new_rider_id: riderId,
            p_reason: 'Admin reassignment via dashboard'
          });
          
          if (rpcError) {
            console.error('❌ reassign_order_rider RPC failed:', { 
              orderId, 
              orderNumber: orderCheck.order_number,
              orderStatus: orderCheck.status,
              newRiderId: riderCheck.id, 
              newRiderName: riderCheck.name,
              riderActive: riderCheck.is_active,
              rpcError: rpcError.message,
              rpcCode: rpcError.code,
              rpcDetails: rpcError.details
            });
            
            return new Response(JSON.stringify({
              success: false,
              error: `Failed to reassign rider: ${rpcError.message}`,
              errorCode: 'REASSIGN_RIDER_FAILED',
              context: {
                orderId,
                orderNumber: orderCheck.order_number,
                orderStatus: orderCheck.status,
                newRiderId: riderCheck.id,
                newRiderName: riderCheck.name,
                rpcError: rpcError.message,
                rpcCode: rpcError.code
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }
          
          const { data: updatedOrder } = await supabaseClient.from('orders').select(`
            *,
            order_items (*),
            order_delivery_schedule (*),
            delivery_zones (id, name, base_fee, is_active)
          `).eq('id', orderId).single();
          
          console.log('✅ Rider reassignment successful:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            newRiderId: riderCheck.id, 
            newRiderName: riderCheck.name 
          });
          
          return new Response(JSON.stringify({
            success: true,
            order: updatedOrder,
            message: `Rider reassigned to ${riderCheck.name} for order ${orderCheck.order_number}`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          console.error('❌ Invalid order status for rider assignment:', { 
            orderId, 
            orderNumber: orderCheck.order_number,
            currentStatus: orderCheck.status,
            validStatuses: ['confirmed', 'preparing', 'ready', 'out_for_delivery']
          });
          
          return new Response(JSON.stringify({
            success: false,
            error: `Order ${orderCheck.order_number} cannot have rider assigned in status: ${orderCheck.status}`,
            errorCode: 'INVALID_ORDER_STATUS',
            context: {
              orderId,
              orderNumber: orderCheck.order_number,
              currentStatus: orderCheck.status,
              validStatuses: ['confirmed', 'preparing', 'ready', 'out_for_delivery']
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }
      }

      case 'bypass_and_update': {
        console.log(`🚨 Admin function: BYPASS cache and update order ${orderId} [${correlationId}]`);
        console.log(`🔍 Using admin user ID: ${adminUserId} (source: ${admin_user_id ? 'request_body' : 'auth_user'})`);
        
        // Enhanced parameter validation for bypass
        if (!orderId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required for bypass update'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        if (!updates || typeof updates !== 'object' || !updates.status) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Status update is required for bypass operation'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Call the manual bypass function directly
        console.log(`🔧 Calling manual_cache_bypass_and_update RPC with params:`, {
          p_order_id: orderId,
          p_new_status: updates.status,
          p_admin_user_id: adminUserId,
          p_bypass_reason: 'admin_409_conflict_resolution'
        });
        
        const { data: bypassResult, error: bypassError } = await supabaseClient.rpc('manual_cache_bypass_and_update', {
          p_order_id: orderId,
          p_new_status: updates.status,
          p_admin_user_id: adminUserId,
          p_bypass_reason: 'admin_409_conflict_resolution'
        });

        if (bypassError) {
          console.error(`❌ Manual bypass RPC failed [${correlationId}]:`, {
            error: bypassError,
            params: {
              p_order_id: orderId,
              p_new_status: updates.status,
              p_admin_user_id: adminUserId,
              adminUserIdSource: admin_user_id ? 'request_body' : 'auth_user'
            },
            correlationId
          });
          return new Response(JSON.stringify({
            success: false,
            error: `Bypass operation failed: ${bypassError.message}`,
            bypassed: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        if (!bypassResult?.success) {
          return new Response(JSON.stringify({
            success: false,
            error: bypassResult?.error || 'Bypass operation failed',
            bypassed: false
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        console.log(`✅ Manual cache bypass successful [${correlationId}]:`, {
          orderId,
          cacheCleared: bypassResult.cache_cleared,
          statusChange: `${bypassResult.old_status} → ${bypassResult.new_status}`
        });

        return new Response(JSON.stringify({
          ...bypassResult,
          correlationId,
          timestamp: new Date().toISOString()
        }), {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Cache-Bypassed': 'true'
          }
        });
      }

      case 'update_status': {
        console.log(`📋 Processing admin request: {
  action: "update_status",
  orderId: "${orderId}",
  newStatus: "${newStatus}",
  timestamp: "${new Date().toISOString()}"
} [${correlationId}]`);
        
        // Validate status
        const validStatuses = [
          'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
          'delivered', 'cancelled', 'refunded', 'completed', 'returned'
        ];
        
        if (!newStatus || !validStatuses.includes(newStatus)) {
          return new Response(JSON.stringify({
            success: false,
            error: `Invalid status: ${newStatus}. Valid statuses: ${validStatuses.join(', ')}`,
            errorCode: 'INVALID_STATUS'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        // Call the enhanced order status update function
        const { data: updateResult, error: updateError } = await supabaseClient.rpc(
          'admin_update_order_status_lock_first',
          {
            p_order_id: orderId,
            p_new_status: newStatus,
            p_admin_user_id: user.id,
            p_notes: `Status updated by admin ${user.email || user.id}`
          }
        );

        if (updateError) {
          console.error('❌ RPC call failed:', updateError);
          
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Database error occurred',
              details: updateError,
              conflict_info: { reason: 'rpc_error' }
            }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Handle structured response from new RPC function
        const result = updateResult?.[0];
        if (!result?.success) {
          console.error('❌ Order status update failed:', result);
          
          // Determine HTTP status based on conflict type
          const conflictReason = result?.conflict_info?.reason;
          const httpStatus = conflictReason === 'max_retries_exceeded' || conflictReason === 'invalid_transition' ? 409 : 400;
          
          return new Response(
            JSON.stringify({
              success: false,
              error: result?.message || 'Failed to update order status',
              conflict_info: result?.conflict_info || { reason: 'unknown' },
              details: result
            }),
            { 
              status: httpStatus,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        // Log successful update with enhanced details
        console.log('✅ Order status updated successfully:', result);

        // Extract order data from the structured response
        const orderData = result.order_data;

        // Queue notification for valid status changes  
        if (orderData && ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].includes(newStatus)) {
          await handleStatusChangeNotification(supabaseClient, orderId, orderData, newStatus, user.id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: result.message,
            order: orderData,
            conflict_info: result.conflict_info
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'update': {
        console.log(`📋 Processing admin request: {
  action: "update",
  orderId: "${orderId}",
  timestamp: "${new Date().toISOString()}"
} [${correlationId}]`);
        console.log('Admin function: Updating order', orderId, 'with updates:', JSON.stringify(updates));
        
        // PRODUCTION FIX: Use maybeSingle() to prevent errors when no records found
        const { data: currentOrder, error: fetchError } = await supabaseClient
          .from('orders')
          .select('status, customer_email, customer_name, order_number')
          .eq('id', orderId)
          .maybeSingle();
          
        if (fetchError) {
          console.error('❌ Failed to fetch current order:', { orderId, error: fetchError.message });
          return new Response(JSON.stringify({
            success: false,
            error: `Failed to fetch order: ${fetchError.message}`,
            errorCode: 'ORDER_FETCH_FAILED'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }

        if (!currentOrder) {
          console.error('❌ Order not found:', { orderId });
          return new Response(JSON.stringify({
            success: false,
            error: `Order not found: ${orderId}`,
            errorCode: 'ORDER_NOT_FOUND'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404
          });
        }

        const allowedColumns = [
          'status', 'customer_name', 'customer_phone', 'customer_email', 'delivery_address',
          'delivery_instructions', 'order_notes', 'assigned_rider_id', 'payment_status',
          'total_amount', 'delivery_zone_id', 'order_type', 'special_instructions',
          'internal_notes', 'updated_at'
        ];
        const validStatuses = [
          'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery',
          'delivered', 'cancelled', 'refunded', 'completed', 'returned'
        ];
        
        const sanitizedUpdates = {};
        if (updates && typeof updates === 'object') {
          for (const [key, value] of Object.entries(updates)){
            if (key === 'status') {
              if (value === null || value === 'null' || value === '' || value === undefined || typeof value !== 'string') {
                return new Response(JSON.stringify({
                  success: false,
                  error: 'Status cannot be null, undefined, empty, or non-string value',
                  errorCode: 'INVALID_STATUS_VALUE'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400
                });
              }
              const trimmedStatus = value.trim();
              if (!trimmedStatus || !validStatuses.includes(trimmedStatus)) {
                return new Response(JSON.stringify({
                  success: false,
                  error: `Invalid status value: "${value}". Valid values are: ${validStatuses.join(', ')}`,
                  errorCode: 'INVALID_STATUS_VALUE'
                }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                  status: 400
                });
              }
              sanitizedUpdates[key] = trimmedStatus;
            } else if (key === 'assigned_rider_id') {
              sanitizedUpdates[key] = (value === 'null' || value === '') ? null : value;
            } else if (allowedColumns.includes(key)) {
              sanitizedUpdates[key] = value;
            }
          }
        }
        sanitizedUpdates.updated_at = new Date().toISOString();

        // CRITICAL FIX: Generate deterministic idempotency key WITHOUT timestamp for true idempotency
        const idempotencyKey = `order_update_${orderId}_${sanitizedUpdates.status}_${adminUserId}`;

        // CRITICAL FIX: Use lock-first approach - this will acquire lock BEFORE cache operations
        // PRODUCTION FIX: Enhanced error handling and retry logic
        let lockFirstResult = null;
        let lockFirstError = null;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            console.log(`🔧 Calling admin_update_order_status_lock_first RPC (attempt ${retryCount + 1}/${maxRetries}) with params:`, {
              p_order_id: orderId,
              p_new_status: sanitizedUpdates.status,
              p_admin_user_id: adminUserId,
              adminUserIdSource: admin_user_id ? 'request_body' : 'auth_user',
              p_notes: `Status updated by admin ${user.email || user.id}`
            });
            
            const result = await supabaseClient.rpc('admin_update_order_status_lock_first', {
              p_order_id: orderId,
              p_new_status: sanitizedUpdates.status,
              p_admin_user_id: adminUserId,
              p_notes: `Status updated by admin ${user.email || user.id}`
            });
            
            lockFirstResult = result.data;
            lockFirstError = result.error;
            
            if (!lockFirstError) {
              break; // Success, exit retry loop
            }
            
            // Check if it's a retryable error
            const errorMessage = lockFirstError?.message?.toLowerCase() || '';
            if (errorMessage.includes('concurrent') || errorMessage.includes('lock') || errorMessage.includes('timeout')) {
              retryCount++;
              if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
                console.log(`⏱️ Retrying order update in ${delay}ms (attempt ${retryCount + 1}/${maxRetries}) [${correlationId}]`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }
            }
            break; // Non-retryable error, exit loop
            
          } catch (rpcError) {
            lockFirstError = rpcError;
            retryCount++;
            if (retryCount >= maxRetries) break;
            
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`⏱️ RPC error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries}) [${correlationId}]`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        // CRITICAL FIX: Enhanced error handling with detailed logging
        if (lockFirstError) {
          const errorDetails = {
            orderId,
            adminUserId,
            newStatus: sanitizedUpdates.status,
            error: lockFirstError?.message || 'Unknown error',
            correlationId,
            retryCount,
            timestamp: new Date().toISOString()
          };
          
          console.error(`❌ Lock-first update failed after ${retryCount} retries [${correlationId}]:`, errorDetails);
          
          // Log error for monitoring
          try {
            await supabaseClient.from('audit_logs').insert([{
              action: 'admin_order_update_edge_function_error',
              category: 'Critical Error',
              message: `Edge function order update failed: ${lockFirstError.message}`,
              user_id: adminUserId,
              entity_id: orderId,
              new_values: errorDetails
            }]);
          } catch (auditError) {
            console.error('⚠️ Failed to log error audit:', auditError.message);
          }
          
          // Return appropriate error response based on error type
          const errorMessage = lockFirstError?.message?.toLowerCase() || '';
          if (errorMessage.includes('concurrent')) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Another admin is currently updating this order. Please wait and try again.',
              errorCode: 'CONCURRENT_UPDATE_IN_PROGRESS',
              correlationId,
              retryAfter: 5
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409
            });
          } else if (errorMessage.includes('invalid status')) {
            return new Response(JSON.stringify({
              success: false,
              error: `Invalid status transition: ${sanitizedUpdates.status}`,
              errorCode: 'INVALID_STATUS_TRANSITION',
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: 'Database error during order update. Please try again.',
              errorCode: 'DATABASE_ERROR',
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
        }

        // Handle structured response from new RPC function
        if (!lockFirstResult?.success) {
          const conflictInfo = lockFirstResult?.conflict_info || {};
          const conflictReason = conflictInfo.reason;
          
          // Handle specific conflict scenarios
          if (conflictReason === 'max_retries_exceeded') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Order is being updated by another admin. Please wait and try again.',
              errorCode: 'CONCURRENT_UPDATE_IN_PROGRESS',
              conflict_info: conflictInfo,
              correlationId,
              retryAfter: 5
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 409
            });
          } else if (conflictReason === 'invalid_transition') {
            return new Response(JSON.stringify({
              success: false,
              error: `Cannot change status from ${conflictInfo.current_status} to ${conflictInfo.requested_status}`,
              errorCode: 'INVALID_STATUS_TRANSITION',
              conflict_info: conflictInfo,
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          } else if (conflictReason === 'order_not_found') {
            return new Response(JSON.stringify({
              success: false,
              error: 'Order not found',
              errorCode: 'ORDER_NOT_FOUND',
              conflict_info: conflictInfo,
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404
            });
          } else if (conflictReason === 'no_change_needed') {
            return new Response(JSON.stringify({
              success: true,
              message: lockFirstResult.message,
              order: lockFirstResult.order_data,
              conflict_info: conflictInfo,
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: lockFirstResult?.message || 'Database error during order update',
              errorCode: 'DATABASE_ERROR',
              conflict_info: conflictInfo,
              correlationId
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
        }

        // CRITICAL FIX: Lock-first approach completed successfully
        console.log(`✅ Order ${orderId} updated successfully via lock-first approach [${correlationId}]`);
        
        const result = {
          success: true,
          message: lockFirstResult.message,
          order: lockFirstResult.order,
          oldStatus: lockFirstResult.old_status,
          newStatus: lockFirstResult.new_status,
          correlationId,
          idempotency_key: idempotencyKey,
          lock_first_approach: true,
          timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bypass_and_update': {
        console.log('🔧 Admin function: Bypass and update order', orderId);
        
        if (!orderId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required for bypass and update',
            errorCode: 'MISSING_ORDER_ID'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        if (!updates || typeof updates !== 'object') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Updates object is required',
            errorCode: 'MISSING_UPDATES'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        try {
          // Step 1: Force cleanup order-specific cache entries
          console.log('🧹 Clearing order cache before bypass update');
          const { data: cacheCleanup } = await supabaseClient
            .rpc('force_clear_order_cache', { p_order_id: orderId });

          // Step 2: Use manual bypass database function
          console.log('🚀 Executing manual bypass update');
          const { data: bypassResult, error: bypassError } = await supabaseClient
            .rpc('manual_cache_bypass_and_update', {
              p_order_id: orderId,
              p_new_status: updates.status,
              p_admin_user_id: adminUserId,
              p_bypass_reason: 'admin_manual_bypass'
            });

          if (bypassError) {
            console.error(`❌ Bypass update failed: ${bypassError.message} [${correlationId}]`);
            return new Response(JSON.stringify({
              success: false,
              error: 'Bypass update failed: ' + bypassError.message,
              errorCode: 'BYPASS_UPDATE_FAILED'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }

          if (!bypassResult?.success) {
            console.error(`❌ Bypass update unsuccessful: ${bypassResult?.error} [${correlationId}]`);
            return new Response(JSON.stringify({
              success: false,
              error: bypassResult?.error || 'Bypass update unsuccessful',
              errorCode: 'BYPASS_UPDATE_UNSUCCESSFUL'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            });
          }

          console.log(`✅ Bypass update completed successfully [${correlationId}]:`, {
            orderId,
            cacheCleared: cacheCleanup?.entries_cleared || 0,
            bypassed: bypassResult.bypassed,
            oldStatus: bypassResult.old_status,
            newStatus: bypassResult.new_status
          });

          const result = {
            success: true,
            message: 'Order updated successfully via cache bypass',
            order: bypassResult.order,
            bypassed: true,
            cache_cleared: cacheCleanup?.entries_cleared || 0,
            old_status: bypassResult.old_status,
            new_status: bypassResult.new_status,
            correlationId,
            timestamp: new Date().toISOString()
          };

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (error) {
          console.error(`❌ Critical error during bypass update [${correlationId}]:`, error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Internal error during bypass update: ' + error.message,
            errorCode: 'BYPASS_INTERNAL_ERROR',
            correlationId
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      case 'delete': {
        console.log('Admin function: Deleting order', orderId);
        const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Order deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'bulk_delete': {
        console.log('Admin function: Bulk deleting orders', orderIds);
        const { error } = await supabaseClient.from('orders').delete().in('id', orderIds);
        if (error) {
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'Orders deleted successfully'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'check_lock_status': {
        console.log('🔍 Admin function: Checking lock status for order', orderId);
        
        if (!orderId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required for lock status check',
            errorCode: 'MISSING_ORDER_ID'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        try {
          // Get lock information using the database function
          const { data: lockInfo, error: lockError } = await supabaseClient
            .rpc('get_order_lock_info', { p_order_id: orderId });

          if (lockError) {
            console.error('❌ Failed to get lock info:', lockError);
            return new Response(JSON.stringify({
              success: false,
              error: 'Failed to retrieve lock information',
              errorCode: 'LOCK_INFO_ERROR'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }

          const lockData = lockInfo && lockInfo.length > 0 ? lockInfo[0] : {
            is_locked: false,
            locking_admin_id: null,
            locking_admin_name: null,
            locking_admin_avatar: null,
            locking_admin_email: null,
            lock_expires_at: null,
            seconds_remaining: 0,
            acquired_at: null
          };

          // Determine if current user is the lock holder
          const isLockHolder = lockData.is_locked && lockData.locking_admin_id === user.id;

          const result = {
            success: true,
            is_locked: lockData.is_locked,
            is_lock_holder: isLockHolder,
            lock_info: lockData,
            current_admin_id: user.id
          };

          console.log('✅ Lock status check completed:', result);

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error checking lock status:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Internal error while checking lock status',
            errorCode: 'INTERNAL_ERROR'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      case 'proactive_cleanup': {
        const { reason } = requestBody;
        console.log('🧹 Admin function: Proactive cleanup for order', orderId, 'reason:', reason);
        
        if (!orderId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Order ID is required for proactive cleanup',
            errorCode: 'MISSING_ORDER_ID'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          });
        }

        try {
          // Step 1: Force clear order-specific cache entries
          const { data: cacheResult, error: cacheError } = await supabaseClient
            .rpc('force_clear_order_cache', { p_order_id: orderId });

          if (cacheError) {
            console.error('❌ Failed to clear order cache:', cacheError);
          }

          // Step 2: Cleanup stuck processing states
          const { data: stuckResult, error: stuckError } = await supabaseClient
            .rpc('cleanup_stuck_request_cache', { p_minutes_threshold: 2 });

          if (stuckError) {
            console.error('❌ Failed to cleanup stuck cache:', stuckError);
          }

          // Step 3: Release any expired locks for this order
          const { data: lockResult, error: lockError } = await supabaseClient
            .rpc('cleanup_expired_locks');

          if (lockError) {
            console.error('❌ Failed to cleanup expired locks:', lockError);
          }

          const result = {
            success: true,
            cleanup_performed: {
              order_cache_cleared: cacheResult?.entries_cleared || 0,
              stuck_cache_cleaned: stuckResult?.total_cleaned || 0,
              expired_locks_cleaned: lockResult || 0
            },
            reason: reason || 'proactive_cleanup',
            timestamp: new Date().toISOString()
          };

          // Log the proactive cleanup for monitoring
          try {
            await supabaseClient.from('audit_logs').insert([{
              action: 'proactive_cleanup_performed',
              category: 'Cache Management',
              message: `Proactive cleanup performed for order ${orderId}`,
              entity_id: orderId,
              user_id: user.id,
              new_values: result
            }]);
          } catch (auditError) {
            console.warn('⚠️ Failed to log proactive cleanup:', auditError);
          }

          console.log('✅ Proactive cleanup completed:', result);

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error during proactive cleanup:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Internal error during proactive cleanup',
            errorCode: 'CLEANUP_ERROR'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
      }

      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
    }
  } catch (error) {
    // Enhanced Error Handling and Logging with Correlation ID
    const errorId = `admin-orders-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const errorDetails = {
      errorId,
      correlationId: correlationId || 'unknown',
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace',
      timestamp: new Date().toISOString(),
      requestMethod: req.method,
      requestHeaders: Object.fromEntries(req.headers.entries()),
      requestUrl: req.url
    };

    console.error(`❌ Admin orders manager critical error [${correlationId || 'unknown'}]:`, {
      ...errorDetails,
      // Sanitize sensitive headers for logging
      requestHeaders: {
        ...errorDetails.requestHeaders,
        authorization: errorDetails.requestHeaders.authorization ? '[REDACTED]' : undefined
      }
    });

    // Categorize error types for better monitoring and user feedback
    let errorCategory = 'UNKNOWN_ERROR';
    let httpStatus = 500;
    let userMessage = 'An unexpected error occurred. Please try again.';
    let retryAfter = null;

    if (error.message?.includes('duplicate key')) {
      errorCategory = 'DUPLICATE_KEY_ERROR';
      userMessage = 'This operation conflicts with existing data. Please refresh and try again.';
      httpStatus = 409;
      retryAfter = 3;
    } else if (error.message?.includes('foreign key')) {
      errorCategory = 'FOREIGN_KEY_ERROR';
      userMessage = 'Invalid reference to related data. Please check your input.';
      httpStatus = 400;
    } else if (error.message?.includes('not found') || error.message?.includes('does not exist')) {
      errorCategory = 'NOT_FOUND_ERROR';
      httpStatus = 404;
      userMessage = 'The requested resource was not found.';
    } else if (error.message?.includes('permission') || error.message?.includes('access')) {
      errorCategory = 'PERMISSION_ERROR';
      httpStatus = 403;
      userMessage = 'You do not have permission to perform this action.';
    } else if (error.message?.includes('network') || error.message?.includes('timeout')) {
      errorCategory = 'NETWORK_ERROR';
      httpStatus = 503;
      userMessage = 'Service temporarily unavailable. Please try again in a moment.';
      retryAfter = 10;
    } else if (error.message?.includes('lock') || error.message?.includes('concurrent')) {
      errorCategory = 'CONCURRENT_UPDATE_ERROR';
      httpStatus = 409;
      userMessage = 'Another admin is currently updating this order. Please wait and try again.';
      retryAfter = 5;
    }

    // Log to audit table for monitoring (non-blocking)
    try {
      await supabaseClient.from('audit_logs').insert([{
        action: 'admin_orders_manager_error',
        category: 'Critical System Error',
        message: `Admin orders manager error: ${errorCategory}`,
        new_values: {
          errorId,
          correlationId: correlationId || 'unknown',
          errorCategory,
          message: error.message,
          stack: error.stack?.substring(0, 1000), // Limit stack trace length
          timestamp: new Date().toISOString(),
          httpStatus,
          userMessage
        }
      }]);
    } catch (auditError) {
      console.error(`⚠️ Failed to log error to audit table [${correlationId || 'unknown'}]:`, auditError.message);
    }

    const responseHeaders = { 
      ...corsHeaders, 
      'Content-Type': 'application/json',
      'X-Error-ID': errorId,
      'X-Error-Category': errorCategory,
      'X-Correlation-ID': correlationId || 'unknown'
    };

    if (retryAfter) {
      responseHeaders['Retry-After'] = retryAfter.toString();
    }

    return new Response(JSON.stringify({
      success: false,
      error: userMessage,
      errorCode: errorCategory,
      errorId: errorId,
      correlationId: correlationId || 'unknown',
      timestamp: new Date().toISOString(),
      ...(retryAfter && { retryAfter }),
      // Include more details in development/debugging
      ...(Deno.env.get('ENVIRONMENT') === 'development' && {
        details: {
          originalError: error.message,
          stack: error.stack
        }
      })
    }), {
      status: httpStatus,
      headers: responseHeaders
    });
  }
});

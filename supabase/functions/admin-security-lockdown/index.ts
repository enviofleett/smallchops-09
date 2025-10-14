import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(name => !Deno.env.get(name));

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    `Please configure them in the Supabase Dashboard: Edge Functions → Environment Variables`
  );
}

interface LockdownRequest {
  action: 'emergency_lockdown' | 'terminate_session' | 'suspend_user';
  session_id?: string;
  user_id?: string;
  reason?: string;
}

// Validate admin permissions
async function validateAdminUser(client: any, admin: any, authHeader: string) {
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Verify JWT token directly (no session needed)
  const { data: { user }, error: userError } = await client.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Invalid authentication token');
  }

  // Check if user has admin privileges using admin client
  const { data: isAdmin, error: roleError } = await admin
    .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

  const userEmail = (user.email ?? '').toLowerCase();
  const hasAdminAccess = isAdmin || userEmail === 'toolbuxdev@gmail.com';

  if (roleError || !hasAdminAccess) {
    throw new Error('Admin privileges required');
  }

  return user;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing environment variables`);
      throw new Error('Server configuration error');
    }

    // Client for auth verification (anon key)
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    // Admin client for DB operations (service role)
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Validate requesting admin
    const authHeader = req.headers.get('Authorization');
    const requestingAdmin = await validateAdminUser(client, admin, authHeader || '');
    
    console.log(`[${requestId}] Security action requested by:`, requestingAdmin.email);

    // Parse request body
    const body: LockdownRequest = await req.json();
    
    if (!body.action) {
      throw new Error('Action is required');
    }

    console.log(`[${requestId}] Action: ${body.action}`);

    let result = { success: false, message: '', data: {} };

    switch (body.action) {
      case 'emergency_lockdown':
        // Terminate all active admin sessions using admin client
        const { data: sessions, error: sessionsError } = await admin
          .from('admin_sessions')
          .update({ 
            is_active: false, 
            terminated_at: new Date().toISOString(),
            termination_reason: 'Emergency lockdown'
          })
          .eq('is_active', true)
          .select();

        if (sessionsError) {
          throw new Error(`Failed to terminate sessions: ${sessionsError.message}`);
        }

        // Log the emergency action using admin client
        await admin
          .from('audit_logs')
          .insert({
            action: 'emergency_lockdown_activated',
            category: 'Critical Security',
            message: `Emergency lockdown activated by admin ${requestingAdmin.email}`,
            user_id: requestingAdmin.id,
            new_values: {
              terminated_sessions: sessions?.length || 0,
              reason: body.reason || 'Emergency security measure',
              timestamp: new Date().toISOString()
            }
          });

        result = {
          success: true,
          message: `Emergency lockdown completed. ${sessions?.length || 0} sessions terminated.`,
          data: { terminated_sessions: sessions?.length || 0 }
        };
        break;

      case 'terminate_session':
        if (!body.session_id) {
          throw new Error('Session ID is required for session termination');
        }

        const { error: terminateError } = await admin
          .from('admin_sessions')
          .update({ 
            is_active: false, 
            terminated_at: new Date().toISOString(),
            termination_reason: body.reason || 'Manual termination'
          })
          .eq('id', body.session_id);

        if (terminateError) {
          throw new Error(`Failed to terminate session: ${terminateError.message}`);
        }

        // Log the action using admin client
        await admin
          .from('audit_logs')
          .insert({
            action: 'admin_session_terminated',
            category: 'Security',
            message: `Admin session ${body.session_id} terminated`,
            user_id: requestingAdmin.id,
            entity_id: body.session_id,
            new_values: {
              reason: body.reason || 'Manual termination',
              terminated_by: requestingAdmin.id
            }
          });

        result = {
          success: true,
          message: 'Session terminated successfully',
          data: { session_id: body.session_id }
        };
        break;

      case 'suspend_user':
        if (!body.user_id) {
          throw new Error('User ID is required for user suspension');
        }

        // Suspend the user using admin client
        const { error: suspendError } = await admin
          .from('profiles')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.user_id);

        if (suspendError) {
          throw new Error(`Failed to suspend user: ${suspendError.message}`);
        }

        // Terminate all their sessions using admin client
        await admin
          .from('admin_sessions')
          .update({ 
            is_active: false, 
            terminated_at: new Date().toISOString(),
            termination_reason: 'User suspended'
          })
          .eq('user_id', body.user_id)
          .eq('is_active', true);

        // Log the action using admin client
        await admin
          .from('audit_logs')
          .insert({
            action: 'admin_user_suspended',
            category: 'Security',
            message: `Admin user ${body.user_id} suspended`,
            user_id: requestingAdmin.id,
            entity_id: body.user_id,
            new_values: {
              reason: body.reason || 'Administrative suspension',
              suspended_by: requestingAdmin.id
            }
          });

        result = {
          success: true,
          message: 'User suspended and sessions terminated',
          data: { user_id: body.user_id }
        };
        break;

      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    console.log(`[${requestId}] ${body.action} completed successfully`);

    return new Response(JSON.stringify({ ...result, request_id: requestId }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: 'ADMIN_SECURITY_ERROR',
      request_id: requestId
    }), {
      status: error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
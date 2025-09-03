import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface LockdownRequest {
  action: 'emergency_lockdown' | 'terminate_session' | 'suspend_user';
  session_id?: string;
  user_id?: string;
  reason?: string;
}

// Validate admin permissions
async function validateAdminUser(supabase: any, authHeader: string) {
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Invalid authentication token');
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    throw new Error('Admin privileges required');
  }

  return user;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ADMIN-SECURITY] Missing environment variables');
      throw new Error('Server configuration error');
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Validate requesting admin
    const authHeader = req.headers.get('Authorization');
    const requestingAdmin = await validateAdminUser(supabase, authHeader || '');

    // Parse request body
    const body: LockdownRequest = await req.json();
    
    if (!body.action) {
      throw new Error('Action is required');
    }

    console.log(`[ADMIN-SECURITY] ${body.action} requested by admin: ${requestingAdmin.id}`);

    let result = { success: false, message: '', data: {} };

    switch (body.action) {
      case 'emergency_lockdown':
        // Terminate all active admin sessions
        const { data: sessions, error: sessionsError } = await supabase
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

        // Log the emergency action
        await supabase
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

        const { error: terminateError } = await supabase
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

        // Log the action
        await supabase
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

        // Suspend the user
        const { error: suspendError } = await supabase
          .from('profiles')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.user_id);

        if (suspendError) {
          throw new Error(`Failed to suspend user: ${suspendError.message}`);
        }

        // Terminate all their sessions
        await supabase
          .from('admin_sessions')
          .update({ 
            is_active: false, 
            terminated_at: new Date().toISOString(),
            termination_reason: 'User suspended'
          })
          .eq('user_id', body.user_id)
          .eq('is_active', true);

        // Log the action
        await supabase
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

    console.log(`[ADMIN-SECURITY] ${body.action} completed successfully`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[ADMIN-SECURITY] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: 'ADMIN_SECURITY_ERROR'
    }), {
      status: error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
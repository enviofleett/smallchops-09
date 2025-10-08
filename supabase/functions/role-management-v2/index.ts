import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
const missingVars = requiredEnvVars.filter(name => !Deno.env.get(name));

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    `Please configure them in the Supabase Dashboard: Edge Functions → Environment Variables`
  );
}

interface RoleUpdateRequest {
  userId: string;
  newRole: 'super_admin' | 'admin' | 'manager' | 'support_officer' | 'staff';
  expiresAt?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for auth verification (anon key)
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    // Admin client for DB operations (service role)
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request using anon key client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] Missing Authorization header`);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        request_id: requestId 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Set session on anon key client
    const { error: sessionError } = await client.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    if (sessionError) {
      console.error(`[${requestId}] Session error:`, sessionError);
      return new Response(JSON.stringify({ 
        error: 'Invalid session',
        request_id: requestId 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      console.error(`[${requestId}] Auth error:`, authError);
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        request_id: requestId 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] User authenticated:`, user.email);

    // Check authorization using admin client
    const { data: isSuperAdmin, error: roleError } = await admin
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    const userEmail = (user.email ?? '').toLowerCase();
    const isAuthorized = isSuperAdmin || userEmail === 'toolbuxdev@gmail.com';

    if (roleError) {
      console.error(`[${requestId}] Role check error:`, roleError);
    }

    if (!isAuthorized) {
      console.warn(`[${requestId}] Unauthorized access attempt by:`, user.email);
      return new Response(JSON.stringify({ 
        error: 'Insufficient permissions',
        request_id: requestId 
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { userId, newRole, expiresAt }: RoleUpdateRequest = body;

    // Validate input
    if (!userId || typeof userId !== 'string') {
      console.error(`[${requestId}] Invalid userId:`, userId);
      return new Response(JSON.stringify({ 
        error: 'Invalid or missing userId',
        request_id: requestId 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!newRole || !['super_admin', 'admin', 'manager', 'support_officer', 'staff'].includes(newRole)) {
      console.error(`[${requestId}] Invalid role:`, newRole);
      return new Response(JSON.stringify({ 
        error: 'Invalid role. Must be one of: super_admin, admin, manager, support_officer, staff',
        request_id: requestId 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${requestId}] Processing role update for user:`, userId, 'to role:', newRole);

    // Check if role already exists (using admin client)
    const { data: existingRole, error: fetchError } = await admin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) {
      console.error(`[${requestId}] Error fetching existing role:`, fetchError);
      throw fetchError;
    }

    let result;

    if (existingRole) {
      console.log(`[${requestId}] Updating existing role:`, existingRole.id);
      // Update existing role (using admin client)
      const { data, error } = await admin
        .from('user_roles')
        .update({
          role: newRole,
          expires_at: expiresAt || null,
          assigned_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRole.id)
        .select()
        .single();

      if (error) {
        console.error(`[${requestId}] Error updating role:`, error);
        throw error;
      }
      result = data;
    } else {
      console.log(`[${requestId}] Inserting new role`);
      // Insert new role (using admin client)
      const { data, error } = await admin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: newRole,
          expires_at: expiresAt || null,
          assigned_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error(`[${requestId}] Error inserting role:`, error);
        throw error;
      }
      result = data;
    }

    // Log the action (using admin client)
    const { error: auditError } = await admin.from('audit_logs').insert({
      action: existingRole ? 'role_updated' : 'role_assigned',
      category: 'User Management',
      message: `Role ${existingRole ? 'updated to' : 'assigned:'} ${newRole}`,
      user_id: user.id,
      entity_id: userId,
      new_values: { role: newRole, expires_at: expiresAt, request_id: requestId },
    });

    if (auditError) {
      console.error(`[${requestId}] Error logging audit:`, auditError);
      // Don't fail the request if audit logging fails
    }

    console.log(`[${requestId}] Role operation completed successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Role updated successfully',
      data: result,
      request_id: requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${requestId}] Error in role-management-v2:`, error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

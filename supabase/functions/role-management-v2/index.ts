import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RoleUpdateRequest {
  userId: string;
  newRole: 'super_admin' | 'admin' | 'manager' | 'support_officer' | 'staff';
  expiresAt?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is super_admin using has_role function
    const { data: isSuperAdmin, error: roleError } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'super_admin' });

    if (roleError || !isSuperAdmin) {
      // Special case for toolbuxdev@gmail.com
      if (user.email !== 'toolbuxdev@gmail.com') {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { userId, newRole, expiresAt }: RoleUpdateRequest = await req.json();

    if (!userId || !newRole) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if role already exists
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    let result;

    if (existingRole) {
      // Update existing role
      const { data, error } = await supabase
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

      if (error) throw error;
      result = data;
    } else {
      // Insert new role
      const { data, error } = await supabase
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

      if (error) throw error;
      result = data;
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      action: existingRole ? 'role_updated' : 'role_assigned',
      category: 'User Management',
      message: `Role ${existingRole ? 'updated to' : 'assigned:'} ${newRole}`,
      user_id: user.id,
      entity_id: userId,
      new_values: { role: newRole, expires_at: expiresAt },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Role updated successfully',
      data: result 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in role-management-v2:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

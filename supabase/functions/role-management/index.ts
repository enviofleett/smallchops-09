import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RoleUpdateRequest {
  userId: string;
  newRole: 'super_admin' | 'manager' | 'support_officer';
}

interface CreateUserRequest {
  email: string;
  role: 'super_admin' | 'manager' | 'support_officer';
  name?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Verify the user is authenticated and get their role
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Check if user is super_admin or toolbuxdev@gmail.com
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isSuperAdmin = profile?.role === 'super_admin' || user.email === 'toolbuxdev@gmail.com';
    
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only super admins can manage roles." }),
        { 
          status: 403, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const url = new URL(req.url);
    const method = req.method;

    // Handle role update
    if (method === "PUT" && url.pathname.endsWith('/update-role')) {
      const { userId, newRole }: RoleUpdateRequest = await req.json();

      if (!userId || !newRole) {
        return new Response(
          JSON.stringify({ error: "userId and newRole are required" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Prevent users from removing their own super_admin role
      if (userId === user.id && profile?.role === 'super_admin' && newRole !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: "Cannot remove super_admin role from yourself" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Log the role change
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action: 'role_updated',
          entity_type: 'user',
          entity_id: userId,
          metadata: { 
            old_role: profile?.role,
            new_role: newRole,
            updated_by: user.id 
          },
          performed_by: user.id
        });

      return new Response(
        JSON.stringify({ success: true }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Handle user creation invitation
    if (method === "POST" && url.pathname.endsWith('/create-user-invitation')) {
      const { email, role, name }: CreateUserRequest = await req.json();

      if (!email || !role) {
        return new Response(
          JSON.stringify({ error: "email and role are required" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      
      if (existingUser.user) {
        return new Response(
          JSON.stringify({ error: "User with this email already exists" }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Create invitation record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

      const { data: invitation, error: inviteError } = await supabaseAdmin
        .from('user_invitations')
        .insert({
          email,
          role,
          name,
          invited_by: user.id,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (inviteError) {
        return new Response(
          JSON.stringify({ error: inviteError.message }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // Log the invitation creation
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          action: 'user_invited',
          entity_type: 'user_invitation',
          entity_id: invitation.id,
          metadata: { 
            email,
            role,
            invited_by: user.id 
          },
          performed_by: user.id
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expires_at: invitation.expires_at
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Endpoint not found" }),
      { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error('Role management error:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
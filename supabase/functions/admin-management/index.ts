import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)

    if (!user.user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    if (req.method === 'POST') {
      const body = await req.json()
      const { action, email, role, userId, permissions } = body

      if (action === 'create_admin') {
        // Validate email format
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('Valid email address is required')
        }

        // Check if user already exists
        const { data: existingUser } = await supabaseClient.auth.admin.getUserByEmail(email)
        
        if (existingUser.user) {
          // User exists, update their role
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ role: role || 'admin' })
            .eq('id', existingUser.user.id)

          if (updateError) throw updateError

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'User role updated successfully',
              user: existingUser.user 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // Create invitation
          const { data: invitation, error: inviteError } = await supabaseClient
            .from('admin_invitations')
            .insert({
              email,
              role: role || 'admin',
              invited_by: user.user.id
            })
            .select()
            .single()

          if (inviteError) throw inviteError

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Admin invitation created successfully',
              invitation 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      if (action === 'update_permissions' && userId && permissions) {
        // Delete existing permissions
        await supabaseClient
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)

        // Get admin profile for audit logging
        const { data: adminProfile } = await supabaseClient
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();

        // Get menu structure to determine parent menu sections
        const { data: menuStructure } = await supabaseClient
          .from('menu_structure')
          .select('key, parent_key')
          .eq('is_active', true);

        const menuMap = new Map(menuStructure?.map(m => [m.key, m.parent_key]) || []);

        // Insert new permissions using menu_key
        const permissionsToInsert = Object.entries(permissions)
          .filter(([_, level]) => level !== 'none')
          .map(([menuKey, permissionLevel]) => {
            const parentKey = menuMap.get(menuKey);
            return {
              user_id: userId,
              menu_key: menuKey,
              permission_level: permissionLevel,
              // Keep menu_section for backward compatibility
              menu_section: parentKey || menuKey.split('_')[0] || 'dashboard',
            };
          });

        if (permissionsToInsert.length > 0) {
          const { error } = await supabaseClient
            .from('user_permissions')
            .insert(permissionsToInsert);

          if (error) throw error;
        }

        // Log the permission change
        await supabaseClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'UPDATE',
          category: 'User Management',
          entity_type: 'user_permissions',
          entity_id: userId,
          message: `${adminProfile?.name || 'Admin'} updated permissions for user ${userId}`,
          new_values: permissions
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Permissions updated successfully' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      throw new Error('Invalid action specified')
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const action = url.searchParams.get('action')

      if (action === 'get_admins') {
        const { data: admins, error } = await supabaseClient
          .from('profiles')
          .select('id, name, role, status, created_at')
          .in('role', ['admin', 'manager'])
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ data: admins }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_invitations') {
        const { data: invitations, error } = await supabaseClient
          .from('admin_invitations')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error

        return new Response(
          JSON.stringify({ data: invitations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_permissions' && url.searchParams.get('userId')) {
        const userId = url.searchParams.get('userId')
        const { data: permissions, error } = await supabaseClient
          .from('user_permissions')
          .select('menu_key, permission_level, menu_section, sub_menu_section')
          .eq('user_id', userId)

        if (error) throw error

        return new Response(
          JSON.stringify({ data: permissions }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      throw new Error('Invalid action specified')
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Admin management error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
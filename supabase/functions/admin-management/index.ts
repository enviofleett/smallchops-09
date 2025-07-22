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

        // Insert new permissions
        const permissionsToInsert = Object.entries(permissions)
          .filter(([_, level]) => level !== 'none')
          .map(([menuSection, permissionLevel]) => ({
            user_id: userId,
            menu_section: menuSection,
            permission_level: permissionLevel
          }))

        if (permissionsToInsert.length > 0) {
          const { error } = await supabaseClient
            .from('user_permissions')
            .insert(permissionsToInsert)

          if (error) throw error
        }

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
          .select('*')
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
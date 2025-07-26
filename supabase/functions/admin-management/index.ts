import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/ // Dev/Preview domains
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://oknnklksdiqaifhxaccs.lovableproject.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

// Rate limiting helper
async function checkRateLimit(supabase: any, identifier: string, action: string, limit: number = 10): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - 60000) // 1 minute window
    
    const { data, error } = await supabase
      .from('rate_limits')
      .select('count')
      .eq('identifier', identifier)
      .eq('action', action)
      .gte('window_start', windowStart.toISOString())
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Rate limit check error:', error)
      return true // Allow on error
    }

    if (data && data.count >= limit) {
      return false
    }

    // Update or insert rate limit record
    await supabase
      .from('rate_limits')
      .upsert(
        { 
          identifier, 
          action, 
          count: (data?.count || 0) + 1,
          window_start: windowStart.toISOString()
        },
        { onConflict: 'identifier,action,window_start' }
      )

    return true
  } catch (err) {
    console.error('Rate limiting error:', err)
    return true // Allow on error
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Enhanced authentication validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token || token.length < 10) {
      console.error('Invalid token format')
      return new Response(
        JSON.stringify({ error: 'Invalid token format' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: user, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user.user) {
      console.error('Authentication failed:', userError?.message)
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting check
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const rateLimitPassed = await checkRateLimit(supabaseClient, `${user.user.id}:${clientIP}`, 'admin_action', 30)
    if (!rateLimitPassed) {
      console.error('Rate limit exceeded for user:', user.user.id)
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, status')
      .eq('id', user.user.id)
      .single()

    if (profileError || !profile) {
      console.error('Profile fetch failed:', profileError?.message)
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.role !== 'admin') {
      console.error('Non-admin user attempted admin action:', user.user.id)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.status !== 'active') {
      console.error('Inactive admin user attempted action:', user.user.id)
      return new Response(
        JSON.stringify({ error: 'Account is not active' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      // Extract action from query params for GET requests
      const url = new URL(req.url)
      const action = url.searchParams.get('action')
      const userId = url.searchParams.get('userId')
      
      console.log(`[ADMIN-GET] Action: ${action}, UserId: ${userId}, URL: ${url.pathname}${url.search}`)
      
      if (!action) {
        console.error('No action specified in GET request')
        return new Response(
          JSON.stringify({ error: 'Action parameter is required for GET requests' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'get_admins') {
        console.log('Fetching admin users...')
        
        // Log the admin action
        await supabaseClient.rpc('log_admin_management_action', {
          action_type: 'get_admins',
          target_user_id: null,
          target_email: null,
          action_data: { requested_by: user.user.id }
        })
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
        console.log('Fetching admin invitations...')
        
        // Log the admin action
        await supabaseClient.rpc('log_admin_management_action', {
          action_type: 'get_invitations',
          target_user_id: null,
          target_email: null,
          action_data: { requested_by: user.user.id }
        })

        const { data: invitations, error } = await supabaseClient
          .from('admin_invitations')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Failed to fetch invitations:', error)
          throw error
        }

        console.log(`Successfully fetched ${invitations?.length || 0} invitations`)
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
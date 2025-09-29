// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Authenticate admin user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing authorization' 
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid authentication' 
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Access denied - admin privileges required' 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get request body
    const body = await req.json()
    console.log('[ADMIN-CREATOR] Creating admin user:', body.email)
    
    // Validate input
    if (!body.email || !body.role) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email and role are required' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return new Response(JSON.stringify({ 
        success: false, 
        code: 'INVALID_EMAIL',
        error: 'Invalid email format' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if user already exists in auth and profiles
    try {
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const userExists = existingUsers?.users?.find(u => 
        u.email?.toLowerCase() === body.email.toLowerCase()
      )
      
      if (userExists) {
        console.log('[ADMIN-CREATOR] User already exists:', body.email)
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists' 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Also check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', body.email.toLowerCase())
        .maybeSingle()
      
      if (existingProfile) {
        console.log('[ADMIN-CREATOR] Profile already exists:', body.email)
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists' 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    } catch (listError) {
      console.warn('[ADMIN-CREATOR] Could not list users, proceeding with creation')
    }

    // Create user
    const createUserData = {
      email: body.email,
      user_metadata: {
        role: body.role,
        created_by_admin: true
      }
    }

    if (body.immediate_password) {
      createUserData.password = body.immediate_password
      createUserData.email_confirm = true
    } else {
      createUserData.email_confirm = false
    }

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser(createUserData)

    if (createError) {
      console.error('[ADMIN-CREATOR] User creation failed:', createError)
      
      if (createError.message?.includes('already') || createError.message?.includes('exists')) {
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists' 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create user: ${createError.message}` 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Create profile with upsert to handle edge cases
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        name: body.username || body.email.split('@')[0],
        email: body.email,
        role: body.role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })

    if (profileError) {
      console.error('[ADMIN-CREATOR] Profile creation failed:', profileError)
      
      // Check if it's a duplicate key error
      if (profileError.code === '23505') {
        console.log('[ADMIN-CREATOR] Profile already exists, cleaning up auth user')
        await supabase.auth.admin.deleteUser(newUser.user.id)
        
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists' 
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      // Cleanup user if profile creation fails for other reasons
      await supabase.auth.admin.deleteUser(newUser.user.id)
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create user profile: ${profileError.message}` 
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log the creation
    await supabase
      .from('audit_logs')
      .insert({
        action: 'admin_user_created',
        category: 'Admin Management',
        message: `Admin user created: ${body.email}`,
        user_id: user.id,
        entity_id: newUser.user.id,
        new_values: {
          email: body.email,
          role: body.role,
          created_by: user.id
        }
      })

    console.log('[ADMIN-CREATOR] User created successfully:', newUser.user.id)

    const responseData = {
      user_id: newUser.user.id,
      email: body.email,
      role: body.role,
      immediate_access: !!body.immediate_password
    }

    if (body.immediate_password) {
      responseData.password = body.immediate_password
    }

    return new Response(JSON.stringify({
      success: true, 
      message: body.immediate_password 
        ? 'Admin user created with immediate access'
        : 'Admin user created successfully',
      data: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[ADMIN-CREATOR] Unexpected error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
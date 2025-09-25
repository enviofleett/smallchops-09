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
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Server configuration error' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get request body
    const body = await req.json()
    console.log('[ADMIN-CREATOR] Creating admin user:', body.email)
    
    // Basic validation
    if (!body.email || !body.role) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email and role are required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.immediate_password || undefined,
      email_confirm: !!body.immediate_password,
      user_metadata: {
        role: body.role,
        created_by_admin: true
      }
    })

    if (createError) {
      console.error('[ADMIN-CREATOR] User creation failed:', createError)
      
      // Handle duplicate email error
      if (createError.message?.includes('already') || createError.message?.includes('exists')) {
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create user: ${createError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        name: body.email.split('@')[0],
        email: body.email,
        role: body.role,
        is_active: true
      })

    if (profileError) {
      console.error('[ADMIN-CREATOR] Profile creation failed:', profileError)
      // Cleanup user if profile creation fails
      await supabase.auth.admin.deleteUser(newUser.user.id)
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create user profile: ${profileError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[ADMIN-CREATOR] User created successfully:', newUser.user.id)

    return new Response(JSON.stringify({
      success: true, 
      message: 'Admin user created successfully',
      data: {
        user_id: newUser.user.id,
        email: body.email,
        role: body.role,
        password: body.immediate_password || null
      }
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
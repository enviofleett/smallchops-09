// Admin User Creator Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Utility: Safe JSON parsing with validation
async function safeJsonParse(req: Request) {
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return null
  }
  
  try {
    const text = await req.text()
    if (!text.trim()) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Utility: Standardized JSON response
function jsonResponse(
  body: { success: boolean; data?: any; error?: string; code?: string; message?: string },
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Utility: Get authenticated admin user
async function getAuthenticatedAdminUser(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw { status: 401, code: 'MISSING_AUTH', message: 'Missing authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  
  if (userError || !user) {
    throw { status: 401, code: 'INVALID_TOKEN', message: 'Invalid token' }
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw { status: 403, code: 'ACCESS_DENIED', message: 'Access denied - profile not found' }
  }

  if (profile.role !== 'admin' || !profile.is_active) {
    throw { status: 403, code: 'ACCESS_DENIED', message: 'Access denied - admin privileges required' }
  }

  return user
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ADMIN-CREATOR] Missing Supabase environment variables')
      return jsonResponse({ 
        success: false, 
        error: 'Server misconfiguration', 
        code: 'SERVER_CONFIG' 
      }, 500)
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Authenticate and authorize user
    const user = await getAuthenticatedAdminUser(supabase, req)
    
    if (req.method !== 'POST') {
      return jsonResponse({ 
        success: false, 
        error: 'Method not allowed', 
        code: 'METHOD_NOT_ALLOWED' 
      }, 405)
    }

    // Safe JSON parsing
    const body = await safeJsonParse(req)
    
    if (!body) {
      throw { 
        status: 400, 
        code: 'BAD_JSON', 
        message: 'Invalid or empty JSON body' 
      }
    }

    return await createAdminUser(supabase, body, user)

  } catch (error: any) {
    const status = error?.status || 500
    const code = error?.code || 'UNEXPECTED_ERROR'
    const message = error?.message || 'Unexpected error occurred'
    
    console.error('[ADMIN-CREATOR] Error:', { status, code, message, url: req.url })
    
    return jsonResponse({ 
      success: false, 
      error: message, 
      code 
    }, status)
  }
})

async function createAdminUser(supabase: any, body: any, createdBy: any) {
  console.log('[ADMIN-CREATOR] Creating admin user:', body.email)
  
  // Enhanced input validation
  if (!body.email || !body.role) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'Email and role are required' 
    }
  }

  // More robust email validation
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
  if (!emailRegex.test(body.email)) {
    throw { 
      status: 400, 
      code: 'INVALID_EMAIL', 
      message: 'Invalid email format' 
    }
  }

  if (!['admin', 'user'].includes(body.role)) {
    throw { 
      status: 400, 
      code: 'INVALID_ROLE', 
      message: 'Role must be either "admin" or "user"' 
    }
  }

  // Check if user already exists in auth.users
  const { data: existingAuthUsers, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('[ADMIN-CREATOR] Error checking existing users:', listError)
    throw { 
      status: 500, 
      code: 'USER_CHECK_FAILED', 
      message: 'Failed to check existing users' 
    }
  }

  const userExists = existingAuthUsers?.users?.some(user => 
    user.email?.toLowerCase() === body.email.toLowerCase()
  )

  if (userExists) {
    console.log('[ADMIN-CREATOR] User already exists:', body.email)
    return jsonResponse({
      success: false,
      code: 'USER_EXISTS',
      message: 'A user with this email already exists'
    })
  }

  // Also check profiles table as backup verification
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('email', body.email.toLowerCase())
    .single()

  if (existingProfile) {
    console.log('[ADMIN-CREATOR] User profile already exists:', body.email)
    return jsonResponse({
      success: false,
      code: 'USER_EXISTS',
      message: 'A user with this email already exists'
    })
  }

  const hasImmediateAccess = body.immediate_password && body.immediate_password.length > 0
  
  let createdUser
  let userPassword = body.immediate_password

  if (hasImmediateAccess) {
    // Create user with password and automatically verify email
    console.log('[ADMIN-CREATOR] Creating user with immediate access and auto-verified email')
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: userPassword,
      email_confirm: true, // Automatically confirm email - this bypasses email verification
      user_metadata: {
        role: body.role,
        created_by_admin: true,
        immediate_access: true,
        created_at: new Date().toISOString()
      }
    })

    if (createError) {
      console.error('[ADMIN-CREATOR] Error creating user:', createError)
      throw { 
        status: 500, 
        code: 'USER_CREATION_FAILED', 
        message: `Failed to create user: ${createError.message}` 
      }
    }

    createdUser = newUser.user
    console.log('[ADMIN-CREATOR] User created with auto-verified email:', createdUser.id)

  } else {
    // Create user without password - they'll need to use password reset
    console.log('[ADMIN-CREATOR] Creating user for invitation flow')
    
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: body.email,
      email_confirm: false, // Will need to verify via email
      user_metadata: {
        role: body.role,
        created_by_admin: true,
        immediate_access: false,
        created_at: new Date().toISOString()
      }
    })

    if (createError) {
      console.error('[ADMIN-CREATOR] Error creating user:', createError)
      throw { 
        status: 500, 
        code: 'USER_CREATION_FAILED', 
        message: `Failed to create user: ${createError.message}` 
      }
    }

    createdUser = newUser.user
  }

  // Create profile for the user
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: createdUser.id,
      name: body.email.split('@')[0], // Use email prefix as default name
      email: body.email,
      role: body.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    console.error('[ADMIN-CREATOR] Error creating profile:', profileError)
    // Try to clean up the created user
    try {
      await supabase.auth.admin.deleteUser(createdUser.id)
    } catch (cleanupError) {
      console.error('[ADMIN-CREATOR] Failed to cleanup user after profile error:', cleanupError)
    }
    
    throw { 
      status: 500, 
      code: 'PROFILE_CREATION_FAILED', 
      message: `Failed to create user profile: ${profileError.message}` 
    }
  }

  // Log the user creation
  await supabase
    .from('audit_logs')
    .insert({
      action: 'admin_user_created',
      category: 'Admin Management',
      message: `Admin user created: ${body.email} ${hasImmediateAccess ? '(with immediate access)' : '(invitation flow)'}`,
      user_id: createdBy.id,
      entity_id: createdUser.id,
      new_values: {
        email: body.email,
        role: body.role,
        immediate_access: hasImmediateAccess,
        email_verified: hasImmediateAccess, // Auto-verified for immediate access
        created_by: createdBy.id
      }
    })

  // Send welcome email if requested and not using immediate access
  if (body.send_email && !hasImmediateAccess) {
    try {
      await supabase.functions.invoke('supabase-auth-email-sender', {
        body: {
          templateId: 'admin_welcome',
          to: body.email,
          variables: {
            role: body.role,
            companyName: 'Starters Small Chops',
            login_url: 'https://startersmallchops.com/auth'
          },
          emailType: 'transactional'
        }
      })
      console.log('[ADMIN-CREATOR] Welcome email sent successfully')
    } catch (emailError) {
      console.warn('[ADMIN-CREATOR] Failed to send welcome email:', emailError)
      // Don't fail the whole request if email fails
    }
  }

  const responseData = {
    user_id: createdUser.id,
    email: body.email,
    role: body.role,
    immediate_access: hasImmediateAccess,
    email_verified: hasImmediateAccess
  }

  // Include password in response only for immediate access
  if (hasImmediateAccess) {
    responseData.password = userPassword
  }

  return jsonResponse({
    success: true, 
    message: hasImmediateAccess 
      ? 'Admin user created with immediate access and auto-verified email'
      : 'Admin user created successfully',
    data: responseData
  })
}
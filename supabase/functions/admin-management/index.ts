// Admin Management Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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

interface AdminInvitation {
  email: string;
  role: string;
}

interface AdminUpdate {
  userId: string;
  action: 'activate' | 'deactivate' | 'update_role';
  role?: string;
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
      console.error('[ADMIN] Missing Supabase environment variables')
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

    // Authenticate and authorize user (unified for all routes)
    const user = await getAuthenticatedAdminUser(supabase, req)
    
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (req.method) {
      case 'GET':
        return await handleGet(supabase, action)
      case 'POST':
        return await handlePost(supabase, req, user)
      case 'PUT':
        return await handlePut(supabase, req)
      default:
        return jsonResponse({ 
          success: false, 
          error: 'Method not allowed', 
          code: 'METHOD_NOT_ALLOWED' 
        }, 405)
    }

  } catch (error: any) {
    const status = error?.status || 500
    const code = error?.code || 'UNEXPECTED_ERROR'
    const message = error?.message || 'Unexpected error occurred'
    
    console.error('[ADMIN] Error:', { status, code, message, url: req.url })
    
    return jsonResponse({ 
      success: false, 
      error: message, 
      code 
    }, status)
  }
})

async function handleGet(supabase: any, action: string | null) {
  if (!action) {
    console.warn('[ADMIN-GET] Missing action parameter')
    throw { 
      status: 400, 
      code: 'MISSING_ACTION', 
      message: 'Action parameter is required for GET requests' 
    }
  }

  switch (action) {
    case 'get_admins':
      console.log('[ADMIN-GET] Fetching admin users...')
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, name, email, role, status, created_at, is_active')
        .eq('role', 'admin')
        .order('created_at', { ascending: false })

      if (adminsError) {
        throw { 
          status: 500, 
          code: 'DB_ERROR', 
          message: `Failed to fetch admins: ${adminsError.message}` 
        }
      }

      console.log(`[ADMIN-GET] Successfully fetched ${admins?.length || 0} admins`)
      return jsonResponse({ success: true, data: admins })

    case 'get_invitations':
      console.log('[ADMIN-GET] Fetching admin invitations...')
      const { data: invitations, error: invitationsError } = await supabase
        .from('admin_invitations')
        .select(`
          id,
          email,
          role,
          status,
          expires_at,
          created_at,
          invited_by,
          profiles!admin_invitations_invited_by_fkey(name)
        `)
        .order('created_at', { ascending: false })

      if (invitationsError) {
        throw { 
          status: 500, 
          code: 'DB_ERROR', 
          message: `Failed to fetch invitations: ${invitationsError.message}` 
        }
      }

      console.log(`[ADMIN-GET] Successfully fetched ${invitations?.length || 0} invitations`)
      return jsonResponse({ success: true, data: invitations })

    default:
      throw { 
        status: 400, 
        code: 'INVALID_ACTION', 
        message: `Invalid action for GET request: ${action}` 
      }
  }
}

async function handlePost(supabase: any, req: Request, user: any) {
  // Safe JSON parsing
  const body = await safeJsonParse(req)
  
  if (!body) {
    throw { 
      status: 400, 
      code: 'BAD_JSON', 
      message: 'Invalid or empty JSON body' 
    }
  }

  const action = body.action || 'create_invitation'
  console.log(`[ADMIN-POST] Processing action: ${action}`)

  switch (action) {
    case 'create_invitation':
      return await createInvitation(supabase, body, user)
    case 'update_permissions':
      return await updatePermissions(supabase, body, user)
    case 'delete_invitation':
      return await deleteInvitation(supabase, body, user)
    case 'resend_invitation':
      return await resendInvitation(supabase, body, user)
    default:
      throw { 
        status: 400, 
        code: 'INVALID_ACTION', 
        message: `Invalid action: ${action}` 
      }
  }
}

async function createInvitation(supabase: any, body: any, user: any) {
  console.log('[ADMIN-POST] Sending admin invitation to:', body.email)
  
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

  // Create admin invitation directly in the database
  const invitationToken = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

  const { data: invitation, error: invitationError } = await supabase
    .from('admin_invitations')
    .insert({
      email: body.email,
      role: body.role,
      invitation_token: invitationToken,
      expires_at: expiresAt.toISOString(),
      status: 'pending',
      invited_by: user.id,
      invited_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (invitationError) {
    throw { 
      status: 500, 
      code: 'DB_ERROR', 
      message: `Failed to create invitation: ${invitationError.message}` 
    }
  }

  // Send invitation email using unified SMTP system (non-blocking)
  try {
    await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        template_key: 'admin_invitation',
        to: body.email,
        variables: {
          role: body.role,
          companyName: 'Starters Small Chops',
          invitation_url: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${invitationToken}&type=signup&redirect_to=${encodeURIComponent('https://startersmallchops.com/admin')}`
        },
        email_type: 'transactional'
      }
    })
    console.log('[ADMIN-POST] Invitation email sent successfully')
  } catch (emailError) {
    console.warn('[ADMIN-POST] Failed to send invitation email:', emailError)
    // Don't fail the whole request if email fails
  }

  return jsonResponse({
    success: true, 
    message: 'Invitation sent successfully',
    data: { invitation_id: invitation.id }
  })
}

async function updatePermissions(supabase: any, body: any, user: any) {
  console.log('[ADMIN-PERMISSIONS] Updating permissions for user:', body.userId)
  
  if (!body.userId || !body.permissions) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'User ID and permissions are required' 
    }
  }

  // Validate target user exists and is admin
  const { data: targetUser, error: userError } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', body.userId)
    .eq('role', 'admin')
    .single()

  if (userError || !targetUser) {
    throw { 
      status: 404, 
      code: 'USER_NOT_FOUND', 
      message: 'Target admin user not found' 
    }
  }

  // Delete existing permissions
  await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', body.userId)

  // Insert new permissions
  const permissionInserts = Object.entries(body.permissions)
    .filter(([_, level]) => level !== 'none')
    .map(([menuKey, level]) => ({
      user_id: body.userId,
      menu_key: menuKey,
      permission_level: level,
      granted_by: user.id,
      granted_at: new Date().toISOString()
    }))

  if (permissionInserts.length > 0) {
    const { error: insertError } = await supabase
      .from('user_permissions')
      .insert(permissionInserts)

    if (insertError) {
      throw { 
        status: 500, 
        code: 'DB_ERROR', 
        message: `Failed to update permissions: ${insertError.message}` 
      }
    }
  }

  // Log the permission update
  await supabase
    .from('user_permission_audit')
    .insert({
      user_id: body.userId,
      menu_key: 'bulk_update',
      action: 'permissions_updated',
      permission_level: 'edit',
      changed_by: user.id,
      new_values: body.permissions
    })

  console.log(`[ADMIN-PERMISSIONS] Successfully updated permissions for ${targetUser.name}`)
  return jsonResponse({
    success: true,
    message: `Permissions updated for ${targetUser.name}`
  })
}

async function deleteInvitation(supabase: any, body: any, user: any) {
  console.log('[ADMIN-INVITATION] Deleting invitation:', body.invitationId)
  
  if (!body.invitationId) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'Invitation ID is required' 
    }
  }

  const { data: invitation, error: deleteError } = await supabase
    .from('admin_invitations')
    .delete()
    .eq('id', body.invitationId)
    .select()
    .single()

  if (deleteError) {
    throw { 
      status: 500, 
      code: 'DB_ERROR', 
      message: `Failed to delete invitation: ${deleteError.message}` 
    }
  }

  // Log the deletion
  await supabase
    .from('audit_logs')
    .insert({
      action: 'invitation_deleted',
      category: 'Admin Management',
      message: `Admin invitation deleted: ${invitation.email}`,
      user_id: user.id,
      entity_id: body.invitationId,
      old_values: invitation
    })

  return jsonResponse({
    success: true,
    message: 'Invitation deleted successfully'
  })
}

async function resendInvitation(supabase: any, body: any, user: any) {
  console.log('[ADMIN-INVITATION] Resending invitation:', body.invitationId)
  
  if (!body.invitationId) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'Invitation ID is required' 
    }
  }

  // Get existing invitation
  const { data: invitation, error: fetchError } = await supabase
    .from('admin_invitations')
    .select('*')
    .eq('id', body.invitationId)
    .single()

  if (fetchError || !invitation) {
    throw { 
      status: 404, 
      code: 'INVITATION_NOT_FOUND', 
      message: 'Invitation not found' 
    }
  }

  // Generate new token and extend expiry
  const newToken = crypto.randomUUID()
  const newExpiryDate = new Date()
  newExpiryDate.setDate(newExpiryDate.getDate() + 7)

  const { error: updateError } = await supabase
    .from('admin_invitations')
    .update({
      invitation_token: newToken,
      expires_at: newExpiryDate.toISOString(),
      status: 'pending'
    })
    .eq('id', body.invitationId)

  if (updateError) {
    throw { 
      status: 500, 
      code: 'DB_ERROR', 
      message: `Failed to update invitation: ${updateError.message}` 
    }
  }

  // Send new invitation email
  try {
    await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        template_key: 'admin_invitation',
        to: invitation.email,
        variables: {
          role: invitation.role,
          companyName: 'Starters Small Chops',
          invitation_url: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${newToken}&type=signup&redirect_to=${encodeURIComponent('https://startersmallchops.com/admin')}`
        },
        emailType: 'transactional'
      }
    })
  } catch (emailError) {
    console.warn('[ADMIN-INVITATION] Failed to send resend email:', emailError)
  }

  return jsonResponse({
    success: true,
    message: 'Invitation resent successfully'
  })
}

async function handlePut(supabase: any, req: Request) {
  // Safe JSON parsing
  const body = await safeJsonParse(req)
  
  if (!body) {
    throw { 
      status: 400, 
      code: 'BAD_JSON', 
      message: 'Invalid or empty JSON body' 
    }
  }
  
  console.log('[ADMIN-PUT] Updating admin user:', body)
  
  // Enhanced input validation
  if (!body.userId || !body.action) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'User ID and action are required' 
    }
  }

  if (!['activate', 'deactivate', 'update_role'].includes(body.action)) {
    throw { 
      status: 400, 
      code: 'INVALID_ACTION', 
      message: 'Action must be activate, deactivate, or update_role' 
    }
  }

  let result
  switch (body.action) {
    case 'activate':
      result = await supabase.rpc('activate_admin_user', {
        p_user_id: body.userId
      })
      break
      
    case 'deactivate':
      result = await supabase.rpc('deactivate_admin_user', {
        p_user_id: body.userId
      })
      break
      
    case 'update_role':
      if (!body.role) {
        throw { 
          status: 400, 
          code: 'REQUIRED_FIELDS', 
          message: 'Role is required for update_role action' 
        }
      }
      result = await supabase.rpc('update_admin_role', {
        p_user_id: body.userId,
        p_new_role: body.role
      })
      break
      
    default:
      throw { 
        status: 400, 
        code: 'INVALID_ACTION', 
        message: 'Invalid action' 
      }
  }

  if (result.error) {
    throw { 
      status: 500, 
      code: 'RPC_ERROR', 
      message: `Failed to ${body.action} user: ${result.error.message}` 
    }
  }

  if (!result.data?.success) {
    throw { 
      status: 400, 
      code: 'OPERATION_FAILED', 
      message: result.data?.error || 'Operation failed' 
    }
  }

  return jsonResponse({
    success: true, 
    message: result.data.message
  })
}
// @ts-nocheck
// Admin Management Edge Function - Production Ready
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

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
  status = 200,
  origin?: string | null
) {
  const corsHeaders = getCorsHeaders(origin);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

// Utility: Get authenticated admin user with role-based checking
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

  // Check user role from user_roles table (new system)
  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('role, is_active, expires_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (roleError || !userRole) {
    throw { status: 403, code: 'ACCESS_DENIED', message: 'Access denied - no active admin role' }
  }

  // Check if user has permission to manage admins (super_admin or store_owner)
  const allowedRoles = ['super_admin', 'store_owner', 'admin_manager']
  if (!allowedRoles.includes(userRole.role)) {
    throw { status: 403, code: 'INSUFFICIENT_PERMISSIONS', message: 'Insufficient permissions to manage admins' }
  }

  return { user, role: userRole.role }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
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

    // Authenticate and authorize user with role-based checking
    const { user, role } = await getAuthenticatedAdminUser(supabase, req)
    console.log(`[ADMIN] Authenticated user ${user.id} with role ${role}`)
    
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    switch (req.method) {
      case 'GET':
        return await handleGet(supabase, action)
      case 'POST':
        return await handlePost(supabase, req, user)
      case 'PUT':
        return await handlePut(supabase, req, user)
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
      
      // Get all profiles with user_type='admin'
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, is_active, created_at, updated_at, user_type')
        .eq('user_type', 'admin')
        .order('created_at', { ascending: false })

      if (profilesError) {
        throw { 
          status: 500, 
          code: 'DB_ERROR', 
          message: `Failed to fetch admin profiles: ${profilesError.message}` 
        }
      }

      // Get roles for each admin from user_roles table
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.now()')

      if (rolesError) {
        console.warn('[ADMIN-GET] Failed to fetch roles:', rolesError.message)
      }

      // Map roles to profiles
      const roleMap = new Map()
      if (roles) {
        roles.forEach((r: any) => roleMap.set(r.user_id, r.role))
      }

      const admins = profiles.map((p: any) => ({
        id: p.id,
        name: p.name || p.email,
        email: p.email,
        role: roleMap.get(p.id) || 'admin',
        status: p.is_active ? 'active' : 'inactive',
        is_active: p.is_active,
        created_at: p.created_at
      }))

      console.log(`[ADMIN-GET] Successfully fetched ${admins.length} admins`)
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
          invited_at
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
  const body = await safeJsonParse(req)
  
  if (!body) {
    throw { 
      status: 400, 
      code: 'BAD_JSON', 
      message: 'Invalid or empty JSON body' 
    }
  }

  const action = body.action || 'update_permissions'
  console.log(`[ADMIN-POST] Processing action: ${action}`)

  switch (action) {
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

async function handlePut(supabase: any, req: Request, user: any) {
  const body = await safeJsonParse(req)
  
  if (!body) {
    throw { 
      status: 400, 
      code: 'BAD_JSON', 
      message: 'Invalid or empty JSON body' 
    }
  }

  console.log(`[ADMIN-PUT] Processing action: ${body.action}`)

  if (body.action === 'activate' || body.action === 'deactivate') {
    return await updateUserStatus(supabase, body, user)
  }

  throw { 
    status: 400, 
    code: 'INVALID_ACTION', 
    message: `Invalid action: ${body.action}` 
  }
}

async function updateUserStatus(supabase: any, body: any, user: any) {
  if (!body.userId || !body.action) {
    throw { 
      status: 400, 
      code: 'REQUIRED_FIELDS', 
      message: 'User ID and action are required' 
    }
  }

  const isActive = body.action === 'activate'

  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', body.userId)

  if (error) {
    throw { 
      status: 500, 
      code: 'DB_ERROR', 
      message: `Failed to ${body.action} user: ${error.message}` 
    }
  }

  // Log the action
  await supabase
    .from('audit_logs')
    .insert({
      action: `user_${body.action}d`,
      category: 'Admin Management',
      message: `Admin user ${body.action}d`,
      user_id: user.id,
      entity_id: body.userId
    })

  return jsonResponse({
    success: true,
    message: `User ${body.action}d successfully`
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

  // Validate target user exists
  const { data: targetUser, error: userError } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', body.userId)
    .eq('user_type', 'admin')
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
    .from('audit_logs')
    .insert({
      action: 'permissions_updated',
      category: 'Admin Management',
      message: `Permissions updated for ${targetUser.name}`,
      user_id: user.id,
      entity_id: body.userId,
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

  return jsonResponse({
    success: true,
    message: 'Invitation resent successfully'
  })
}

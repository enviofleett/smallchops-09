import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

serve(async (req) => {
  const origin = req.headers.get('origin');
  
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }
  
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
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
    console.log('[ADMIN-PASSWORD-RESET] Request:', {
      targetUserId: body.targetUserId,
      resetMethod: body.resetMethod
    })
    
    // Validate input
    if (!body.targetUserId || !body.resetMethod) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Target user ID and reset method are required' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if target user exists and is admin
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id, name, email, role, is_active')
      .eq('id', body.targetUserId)
      .single()

    if (!targetProfile) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Target user not found' 
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (targetProfile.role !== 'admin') {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Can only reset passwords for admin users' 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Prevent self-password reset through this endpoint
    if (targetProfile.id === user.id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Cannot reset your own password through this method. Use the regular password reset flow.' 
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let resetResult: any = {}

    if (body.resetMethod === 'temporary_password') {
      // Generate a secure temporary password
      const generateTempPassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
        let password = ''
        for (let i = 0; i < 12; i++) {
          password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return password
      }

      const temporaryPassword = body.temporaryPassword || generateTempPassword()

      // Update user password using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        body.targetUserId,
        {
          password: temporaryPassword,
          user_metadata: {
            ...targetProfile,
            password_reset_required: true,
            password_reset_by: user.id,
            password_reset_at: new Date().toISOString()
          }
        }
      )

      if (updateError) {
        console.error('[ADMIN-PASSWORD-RESET] Password update failed:', updateError)
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to update password: ${updateError.message}` 
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      resetResult = {
        temporaryPassword,
        method: 'temporary_password',
        requiresChange: true
      }

    } else if (body.resetMethod === 'reset_link') {
      // Send password reset email
      const { error: resetError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: targetProfile.email,
        options: {
          redirectTo: `${Deno.env.get('SUPABASE_URL')}/auth/callback?type=recovery`
        }
      })

      if (resetError) {
        console.error('[ADMIN-PASSWORD-RESET] Reset link generation failed:', resetError)
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Failed to generate reset link: ${resetError.message}` 
        }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      resetResult = {
        method: 'reset_link',
        emailSent: true,
        email: targetProfile.email
      }
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid reset method. Use "temporary_password" or "reset_link"' 
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log the password reset action
    await supabase
      .from('audit_logs')
      .insert({
        action: 'admin_password_reset',
        category: 'Security',
        message: `Admin password reset initiated for ${targetProfile.email} using ${body.resetMethod}`,
        user_id: user.id,
        entity_id: body.targetUserId,
        old_values: {
          target_user_email: targetProfile.email,
          target_user_name: targetProfile.name
        },
        new_values: {
          reset_method: body.resetMethod,
          reset_by: user.id,
          reset_timestamp: new Date().toISOString(),
          temporary_password_provided: body.resetMethod === 'temporary_password'
        }
      })

    console.log('[ADMIN-PASSWORD-RESET] Password reset completed successfully')

    return new Response(JSON.stringify({
      success: true, 
      message: `Password reset initiated successfully using ${body.resetMethod}`,
      data: {
        targetUser: {
          id: targetProfile.id,
          name: targetProfile.name,
          email: targetProfile.email
        },
        resetMethod: body.resetMethod,
        ...resetResult
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[ADMIN-PASSWORD-RESET] Unexpected error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
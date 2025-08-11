// Admin Management Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin' || !profile.is_active) {
      throw new Error('Access denied - admin privileges required');
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (req.method) {
      case 'GET':
        return await handleGet(supabase, action);
      case 'POST':
        return await handlePost(supabase, req);
      case 'PUT':
        return await handlePut(supabase, req);
      default:
        throw new Error('Method not allowed');
    }

  } catch (error) {
    console.error('Admin management error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleGet(supabase: any, action: string | null) {
  switch (action) {
    case 'get_admins':
      console.log('Fetching admin users...');
      const { data: admins, error: adminsError } = await supabase
        .from('profiles')
        .select('id, name, email, role, status, created_at, is_active')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (adminsError) {
        throw new Error(`Failed to fetch admins: ${adminsError.message}`);
      }

      console.log(`Successfully fetched ${admins?.length || 0} admins`);
      return new Response(
        JSON.stringify({ success: true, data: admins }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    case 'get_invitations':
      console.log('Fetching admin invitations...');
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
        .order('created_at', { ascending: false });

      if (invitationsError) {
        throw new Error(`Failed to fetch invitations: ${invitationsError.message}`);
      }

      console.log(`Successfully fetched ${invitations?.length || 0} invitations`);
      return new Response(
        JSON.stringify({ success: true, data: invitations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    default:
      throw new Error('Invalid action for GET request');
  }
}

async function handlePost(supabase: any, req: Request) {
  const body: AdminInvitation = await req.json();
  
  console.log('Sending admin invitation to:', body.email);
  
  // Validate input
  if (!body.email || !body.role) {
    throw new Error('Email and role are required');
  }

  if (!body.email.includes('@')) {
    throw new Error('Invalid email format');
  }

  if (!['admin', 'user'].includes(body.role)) {
    throw new Error('Invalid role');
  }

  // Use the database function to send invitation
  const { data, error } = await supabase.rpc('send_admin_invitation', {
    p_email: body.email,
    p_role: body.role
  });

  if (error) {
    throw new Error(`Failed to send invitation: ${error.message}`);
  }

  if (!data.success) {
    throw new Error(data.error);
  }

  // Send invitation email using Auth email system
  try {
    await supabase.functions.invoke('supabase-auth-email-sender', {
      body: {
        templateId: 'admin_invitation',
        to: body.email,
        variables: {
          role: body.role,
          companyName: 'Starters Small Chops',
          invitation_url: `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${data.invitation_token}&type=signup&redirect_to=${encodeURIComponent('https://startersmallchops.com/admin')}`
        },
        emailType: 'transactional'
      }
    });
    console.log('Invitation email sent successfully');
  } catch (emailError) {
    console.warn('Failed to send invitation email:', emailError);
    // Don't fail the whole request if email fails
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: 'Invitation sent successfully',
      data: { invitation_id: data.invitation_id }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handlePut(supabase: any, req: Request) {
  const body: AdminUpdate = await req.json();
  
  console.log('Updating admin user:', body);
  
  // Validate input
  if (!body.userId || !body.action) {
    throw new Error('User ID and action are required');
  }

  let result;
  switch (body.action) {
    case 'activate':
      result = await supabase.rpc('activate_admin_user', {
        p_user_id: body.userId
      });
      break;
      
    case 'deactivate':
      result = await supabase.rpc('deactivate_admin_user', {
        p_user_id: body.userId
      });
      break;
      
    case 'update_role':
      if (!body.role) {
        throw new Error('Role is required for update_role action');
      }
      result = await supabase.rpc('update_admin_role', {
        p_user_id: body.userId,
        p_new_role: body.role
      });
      break;
      
    default:
      throw new Error('Invalid action');
  }

  if (result.error) {
    throw new Error(`Failed to ${body.action} user: ${result.error.message}`);
  }

  if (!result.data.success) {
    throw new Error(result.data.error);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      message: result.data.message
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client for auth verification (anon key)
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    // Admin client for DB operations (service role)
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Authenticate admin user using anon key client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${requestId}] Missing authorization header`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing authorization',
        request_id: requestId
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Set session on anon key client
    const { error: sessionError } = await client.auth.setSession({
      access_token: token,
      refresh_token: ''
    });

    if (sessionError) {
      console.error(`[${requestId}] Session error:`, sessionError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid session',
        request_id: requestId
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: { user }, error: userError } = await client.auth.getUser();
    
    if (userError || !user) {
      console.error(`[${requestId}] Auth error:`, userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid authentication',
        request_id: requestId
      }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[${requestId}] Admin authenticated:`, user.email);

    // Check if user has permission to create admin users (using admin client)
    const { data: canCreateAdmins, error: permError } = await admin
      .rpc('can_create_admin_users', { _user_id: user.id });

    const userEmail = (user.email ?? '').toLowerCase();
    const isAuthorized = canCreateAdmins || userEmail === 'toolbuxdev@gmail.com';

    if (permError) {
      console.error(`[${requestId}] Permission check error:`, permError);
    }

    if (!isAuthorized) {
      console.warn(`[${requestId}] Unauthorized admin user creation attempt by:`, user.email);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Access denied - insufficient privileges to create admin users',
        request_id: requestId
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Get request body
    const body = await req.json();
    const email = (body.email ?? '').toLowerCase().trim();
    const role = body.role;
    const password = body.immediate_password;
    const name = body.name || body.username || email.split('@')[0];

    console.log(`[${requestId}] Creating admin user:`, email, 'with role:', role);
    
    // Validate input
    if (!email || !role) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email and role are required',
        request_id: requestId
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`[${requestId}] Invalid email format:`, email);
      return new Response(JSON.stringify({ 
        success: false, 
        code: 'INVALID_EMAIL',
        error: 'Invalid email format',
        request_id: requestId
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Validate role
    const validRoles = ['super_admin', 'admin', 'manager', 'support_officer', 'staff', 'support_staff', 'admin_manager', 'account_manager', 'store_owner'];
    if (!validRoles.includes(role)) {
      console.error(`[${requestId}] Invalid role:`, role);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        request_id: requestId
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Check if user already exists (idempotency) using admin client
    console.log(`[${requestId}] Checking for existing user...`);
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers();
    
    if (listError) {
      console.error(`[${requestId}] Error listing users:`, listError);
    }

    const existingUser = existingUsers?.users?.find(u => 
      (u.email ?? '').toLowerCase() === email
    );
    
    if (existingUser) {
      console.log(`[${requestId}] User already exists, returning existing user:`, existingUser.id);
      return new Response(JSON.stringify({ 
        success: true,
        message: 'User already exists',
        data: {
          user_id: existingUser.id,
          email: existingUser.email,
          name: existingUser.user_metadata?.name || name,
          role: role,
          already_existed: true
        },
        request_id: requestId
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Create user with minimal payload using admin client
    console.log(`[${requestId}] Creating new user with minimal payload...`);
    
    const createUserData: {
      email: string;
      password?: string;
      email_confirm: boolean;
      user_metadata: Record<string, unknown>;
    } = {
      email: email,
      email_confirm: true, // Skip SMTP verification for admin-created users
      user_metadata: {
        created_by_admin: true,
        name: name
      }
    };

    // Only add password if provided
    if (password) {
      createUserData.password = password;
    }

    console.log(`[${requestId}] Creating user:`, { 
      email: createUserData.email, 
      hasPassword: !!createUserData.password
    });

    const { data: newUser, error: createError } = await admin.auth.admin.createUser(createUserData);

    if (createError) {
      console.error(`[${requestId}] User creation failed:`, createError);
      
      if (createError.message?.includes('already') || createError.message?.includes('exists') || createError.code === '23505') {
        return new Response(JSON.stringify({ 
          success: false, 
          code: 'USER_EXISTS',
          error: 'A user with this email already exists',
          request_id: requestId
        }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to create user: ${createError.message}`,
        request_id: requestId
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[${requestId}] User created successfully:`, newUser.user.id);

    // Update metadata if needed (optional second step)
    if (role !== 'admin') {
      console.log(`[${requestId}] Updating user metadata with role:`, role);
      const { error: updateError } = await admin.auth.admin.updateUserById(newUser.user.id, {
        user_metadata: {
          ...createUserData.user_metadata,
          role: role
        }
      });

      if (updateError) {
        console.error(`[${requestId}] Error updating metadata:`, updateError);
        // Don't fail, metadata update is not critical
      }
    }

    // Assign role in user_roles table (using admin client)
    console.log(`[${requestId}] Assigning role in user_roles table...`);
    const { error: roleError } = await admin
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: role,
        assigned_by: user.id,
        is_active: true,
      });

    if (roleError) {
      console.error(`[${requestId}] Role assignment failed:`, roleError);
      
      // If role assignment fails, clean up the created user
      console.log(`[${requestId}] Cleaning up created user due to role assignment failure`);
      await admin.auth.admin.deleteUser(newUser.user.id);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Failed to assign role: ${roleError.message}`,
        request_id: requestId
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Log the creation (using admin client)
    console.log(`[${requestId}] Logging audit entry...`);
    const { error: auditError } = await admin
      .from('audit_logs')
      .insert({
        action: 'admin_user_created',
        category: 'Admin Management',
        message: `Admin user created: ${email}`,
        user_id: user.id,
        entity_id: newUser.user.id,
        new_values: {
          email: email,
          role: role,
          created_by: user.id,
          request_id: requestId
        }
      });

    if (auditError) {
      console.error(`[${requestId}] Error logging audit:`, auditError);
      // Don't fail if audit logging fails
    }

    console.log(`[${requestId}] Admin user created successfully:`, newUser.user.id);

    const responseData = {
      user_id: newUser.user.id,
      email: email,
      username: body.username || email.split('@')[0],
      name: name,
      role: role,
      immediate_access: !!password,
      request_id: requestId
    };

    if (password) {
      responseData.password = password;
    }

    return new Response(JSON.stringify({
      success: true, 
      message: password 
        ? 'Admin user created with immediate access'
        : 'Admin user created successfully',
      data: responseData
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || 'Internal server error',
      request_id: requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
});
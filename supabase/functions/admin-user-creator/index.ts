import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface CreateAdminRequest {
  email: string;
  role: string;
  immediate_password?: string;
  send_email?: boolean;
  admin_created?: boolean;
}

// Generate secure password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure we have at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
  
  // Fill the rest randomly
  for (let i = 4; i < 16; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Validate admin permissions
async function validateAdminUser(supabase: any, authHeader: string) {
  if (!authHeader) {
    throw new Error('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !user) {
    throw new Error('Invalid authentication token');
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin' || !profile.is_active) {
    throw new Error('Admin privileges required');
  }

  return user;
}

serve(async (req) => {
  console.log(`[ADMIN-CREATE] Request received: ${req.method} ${req.url}`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('[ADMIN-CREATE] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ADMIN-CREATE] Missing environment variables');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error - missing environment variables',
        code: 'CONFIG_ERROR'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('[ADMIN-CREATE] Initializing Supabase client...');
    
    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[ADMIN-CREATE] Validating admin permissions...');
    
    // Validate requesting admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[ADMIN-CREATE] No authorization header provided');
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization required - please log in as admin',
        code: 'AUTH_REQUIRED'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    const requestingAdmin = await validateAdminUser(supabase, authHeader);
    console.log(`[ADMIN-CREATE] Admin validated: ${requestingAdmin.email}`);

    // Parse request body
    let body: CreateAdminRequest;
    try {
      body = await req.json();
      console.log('[ADMIN-CREATE] Request body parsed:', {
        email: body.email,
        role: body.role,
        hasPassword: !!body.immediate_password,
        sendEmail: body.send_email,
        adminCreated: body.admin_created
      });
    } catch (parseError) {
      console.error('[ADMIN-CREATE] Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request format - please check your data',
        code: 'PARSE_ERROR'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    if (!body.email || !body.role) {
      throw new Error('Email and role are required');
    }

    // Validate email format
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(body.email)) {
      throw new Error('Invalid email format');
    }

    // Validate role
    if (!['admin', 'user'].includes(body.role)) {
      throw new Error('Role must be either "admin" or "user"');
    }

    console.log(`[ADMIN-CREATE] Creating admin user: ${body.email}`);

    // Check if user already exists in auth or profiles
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const authUserExists = existingUser.users.find(u => u.email === body.email);
    
    // Also check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', body.email)
      .single();
    
    if (authUserExists || existingProfile) {
      console.log(`[ADMIN-CREATE] User already exists - Auth: ${!!authUserExists}, Profile: ${!!existingProfile}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'User with this email already exists',
        code: 'USER_EXISTS'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Generate password (use provided or generate secure one)
    const password = body.immediate_password || generateSecurePassword();

    // Create auth user with admin client
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: password,
      email_confirm: !body.admin_created, // Skip email confirmation for admin-created users
      user_metadata: {
        role: body.role,
        admin_created: body.admin_created || false,
        created_by: requestingAdmin.id
      }
    });

    if (authError) {
      console.error('[ADMIN-CREATE] Auth user creation failed:', authError);
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    console.log(`[ADMIN-CREATE] Auth user created: ${authData.user?.id}`);

    // Create profile with upsert to handle race conditions
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user!.id,
        email: body.email,
        role: body.role,
        is_active: true,
        name: body.email.split('@')[0], // Default name from email
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (profileError) {
      console.error('[ADMIN-CREATE] Profile creation failed:', profileError);
      // Try to cleanup auth user if profile creation fails
      try {
        await supabase.auth.admin.deleteUser(authData.user!.id);
        console.log('[ADMIN-CREATE] Cleaned up auth user after profile failure');
      } catch (cleanupError) {
        console.error('[ADMIN-CREATE] Failed to cleanup auth user:', cleanupError);
      }
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // Log the creation
    await supabase
      .from('audit_logs')
      .insert({
        action: 'admin_user_created',
        category: 'Admin Management',
        message: `Admin user created: ${body.email} with role ${body.role}`,
        user_id: requestingAdmin.id,
        entity_id: authData.user!.id,
        new_values: {
          email: body.email,
          role: body.role,
          admin_created: body.admin_created,
          immediate_access: !!body.immediate_password
        }
      });

    // Send welcome email if requested (make email sending non-blocking)
    if (body.send_email !== false) {
      try {
        // Use a simpler email approach - don't block on complex email processor
        console.log('[ADMIN-CREATE] Skipping email send - not blocking admin creation');
        // TODO: Implement simple email notification later
      } catch (emailError) {
        console.warn('[ADMIN-CREATE] Email notification skipped:', emailError);
        // Don't fail the entire request if email fails
      }
    }

    const response = {
      success: true,
      message: 'Admin user created successfully',
      data: {
        user_id: authData.user!.id,
        email: body.email,
        role: body.role,
        immediate_access: body.admin_created || !!body.immediate_password,
        password: body.admin_created ? password : undefined // Only return password for admin-created users
      }
    };

    console.log(`[ADMIN-CREATE] Admin user created successfully: ${body.email}`);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[ADMIN-CREATE] Error:', error.message || error);
    
    // Enhanced error logging for production debugging
    console.error('[ADMIN-CREATE] Error stack:', error.stack);
    console.error('[ADMIN-CREATE] Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred while creating admin user';
    
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.message.includes('already exists')) {
      statusCode = 409;
      errorMessage = 'An admin user with this email already exists';
    } else if (error.message.includes('Admin privileges')) {
      statusCode = 403;
      errorMessage = 'Insufficient admin privileges to create users';
    } else if (error.message.includes('Server configuration')) {
      statusCode = 500;
      errorMessage = 'Server configuration error - please contact support';
    } else {
      errorMessage = error.message || errorMessage;
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      code: 'ADMIN_CREATION_ERROR',
      timestamp: new Date().toISOString()
    }), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
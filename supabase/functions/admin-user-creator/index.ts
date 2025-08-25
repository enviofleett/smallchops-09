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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[ADMIN-CREATE] Missing environment variables');
      throw new Error('Server configuration error');
    }

    // Initialize Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Validate requesting admin
    const authHeader = req.headers.get('Authorization');
    const requestingAdmin = await validateAdminUser(supabase, authHeader || '');

    // Parse request body
    const body: CreateAdminRequest = await req.json();
    
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

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser.users.find(u => u.email === body.email);
    
    if (userExists) {
      throw new Error('User with this email already exists');
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

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user!.id,
        email: body.email,
        role: body.role,
        is_active: true,
        name: body.email.split('@')[0], // Default name from email
        email_verified: body.admin_created || false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      console.error('[ADMIN-CREATE] Profile creation failed:', profileError);
      // Try to cleanup auth user
      await supabase.auth.admin.deleteUser(authData.user!.id);
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

    // Send welcome email if requested
    if (body.send_email !== false) {
      try {
        await supabase.functions.invoke('admin-email-processor', {
          body: {
            templateId: 'admin_welcome',
            to: body.email,
            variables: {
              role: body.role,
              password: body.admin_created ? password : undefined,
              login_url: 'https://startersmallchops.com/admin/auth',
              company_name: 'Starters Small Chops',
              created_by: requestingAdmin.email || 'Admin',
              immediate_access: !!body.immediate_password || body.admin_created
            },
            emailType: 'transactional',
            priority: 'high'
          }
        });
        console.log('[ADMIN-CREATE] Welcome email sent');
      } catch (emailError) {
        console.warn('[ADMIN-CREATE] Failed to send welcome email:', emailError);
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
    console.error('[ADMIN-CREATE] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'An unexpected error occurred',
      code: 'ADMIN_CREATION_ERROR'
    }), {
      status: error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
});
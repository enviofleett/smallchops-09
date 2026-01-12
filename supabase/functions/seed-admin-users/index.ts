import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminUser {
  email: string;
  password: string;
  role: string;
}

const ADMIN_USERS: AdminUser[] = [
  { email: 'emmanuelaudokw@gmail.com', password: '@Password100%', role: 'store_owner' },
  { email: 'support@telesoftas.africa', password: '@Password100%', role: 'store_owner' },
];

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; message: string }[] = [];

    for (const adminUser of ADMIN_USERS) {
      console.log(`Processing admin user: ${adminUser.email}`);

      // Check if user already exists
      const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error(`Error listing users: ${listError.message}`);
        results.push({ 
          email: adminUser.email, 
          status: 'error', 
          message: `Failed to check existing users: ${listError.message}` 
        });
        continue;
      }

      const existingUser = existingUsers.users.find(u => u.email === adminUser.email);

      if (existingUser) {
        console.log(`User ${adminUser.email} already exists`);
        results.push({ 
          email: adminUser.email, 
          status: 'exists', 
          message: 'User already exists. They can login with their existing password or reset it.' 
        });
        continue;
      }

      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: adminUser.email,
        password: adminUser.password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: adminUser.role,
          created_by: 'seed-admin-users',
        },
      });

      if (createError) {
        console.error(`Error creating user ${adminUser.email}: ${createError.message}`);
        results.push({ 
          email: adminUser.email, 
          status: 'error', 
          message: `Failed to create user: ${createError.message}` 
        });
        continue;
      }

      console.log(`Successfully created user: ${adminUser.email}`);

      // Also insert role in user_roles table
      if (newUser?.user) {
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: newUser.user.id,
            role: adminUser.role,
            is_active: true,
          });

        if (roleError) {
          console.warn(`Warning: Could not insert role for ${adminUser.email}: ${roleError.message}`);
        }
      }

      results.push({ 
        email: adminUser.email, 
        status: 'created', 
        message: `User created successfully with password: ${adminUser.password}` 
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Admin users seeding completed. Users can change their password after logging in via Profile settings.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Seed admin users error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_USERS = [
  { email: 'emmanuelaudokw@gmail.com', password: '@Password100%' },
  { email: 'support@telesoftas.africa', password: '@Password100%' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { email: string; status: string; message: string }[] = [];

    // Get all users
    const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    for (const adminUser of ADMIN_USERS) {
      console.log(`Resetting password for: ${adminUser.email}`);

      const existingUser = allUsers.users.find(u => u.email === adminUser.email);

      if (!existingUser) {
        results.push({ 
          email: adminUser.email, 
          status: 'not_found', 
          message: 'User not found in the system' 
        });
        continue;
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: adminUser.password }
      );

      if (updateError) {
        console.error(`Error updating password for ${adminUser.email}: ${updateError.message}`);
        results.push({ 
          email: adminUser.email, 
          status: 'error', 
          message: `Failed to reset password: ${updateError.message}` 
        });
        continue;
      }

      console.log(`Successfully reset password for: ${adminUser.email}`);
      results.push({ 
        email: adminUser.email, 
        status: 'success', 
        message: `Password reset to: ${adminUser.password}` 
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        message: 'Password reset completed. Users can now login with the new password.' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Reset passwords error:', error);
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

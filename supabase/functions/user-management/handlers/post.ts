
import { supabase, corsHeaders } from '../utils.ts';

async function handleUpdatePermissions(body: any): Promise<Response> {
    console.log("Updating user permissions...");
    const { userId, permissions } = body;

    if (!userId || !permissions) {
      return new Response(JSON.stringify({ error: "userId and permissions are required" }), { status: 400, headers: corsHeaders });
    }
    
    const { error: deleteError } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting old permissions:', deleteError);
      return new Response(JSON.stringify({ error: `Failed to update permissions: ${deleteError.message}` }), { status: 500, headers: corsHeaders });
    }

    if (permissions.length > 0) {
        const permissionsToInsert = permissions.map((p: any) => ({
            user_id: userId,
            menu_section: p.menu_section,
            permission_level: p.permission_level,
        }));

        const { data, error: insertError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert)
          .select();

        if (insertError) {
          console.error('Error inserting new permissions:', insertError);
          return new Response(JSON.stringify({ error: `Failed to update permissions: ${insertError.message}` }), { status: 500, headers: corsHeaders });
        }
        console.log('Permissions updated successfully for user:', userId);
        return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    
    console.log('Permissions cleared successfully for user:', userId);
    return new Response(JSON.stringify({ message: 'Permissions updated successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
}

async function handleCreateUser(body: any): Promise<Response> {
    console.log("Creating new user with permissions...");
    const { email, password, name, role, permissions } = body;

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password, and name are required" }), 
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`Creating user with email: ${email}`);
    
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      email_confirm: true,
    });

    if (createError) {
      console.log("User creation error:", createError);
      return new Response(
        JSON.stringify({ error: `User creation failed: ${createError.message}` }), 
        { status: 400, headers: corsHeaders }
      );
    }

    const newUserId = createData.user?.id;
    if (!newUserId) {
        console.error("User created but ID not returned.");
        return new Response(JSON.stringify({ error: "User created but failed to retrieve user ID." }), { status: 500, headers: corsHeaders });
    }
    
    console.log(`User created with ID: ${newUserId}. Setting role and permissions...`);
    
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: role || "admin", name })
      .eq("id", newUserId);

    if (profileError) {
      console.log("Profile update error:", profileError);
      // Don't fail the request, user was created successfully
    }

    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        const permissionsToInsert = permissions.map((p: any) => ({
            user_id: newUserId,
            menu_section: p.menu_section,
            permission_level: p.permission_level,
        }));

        const { error: insertError } = await supabase
          .from('user_permissions')
          .insert(permissionsToInsert);

        if (insertError) {
          console.error('Error inserting new permissions:', insertError);
          // Not fatal as the user is created. Admin can set permissions later.
        } else {
            console.log('Permissions set successfully for new user:', newUserId);
        }
    }

    console.log("User created and configured successfully");
    return new Response(JSON.stringify({ user: createData.user }), { headers: {...corsHeaders, "Content-Type": "application/json"} });
}


export async function handlePost(req: Request): Promise<Response> {
    console.log("Checking for permission update or user creation...");
    let body;
    
    try {
      if (req.body) {
        body = await req.json();
      }
      
      if (!body) {
        return new Response(JSON.stringify({ error: "Request body is empty or invalid" }), { status: 400, headers: corsHeaders });
      }
      console.log("Parsed request body:", body);
    } catch (parseError) {
      console.log("JSON parse error:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }), 
        { status: 400, headers: corsHeaders }
      );
    }

    if (body.action === 'update_permissions') {
        return handleUpdatePermissions(body);
    } else {
        return handleCreateUser(body);
    }
}

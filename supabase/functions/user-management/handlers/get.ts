
import { supabase, corsHeaders } from '../utils.ts';

export async function handleGet(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userIdForPermissions = url.searchParams.get("userId");

  if (userIdForPermissions) {
    console.log(`Fetching permissions for user: ${userIdForPermissions}`);
    const { data: permissions, error: permissionsError } = await supabase
      .from("user_permissions")
      .select("*")
      .eq("user_id", userIdForPermissions);

    if (permissionsError) {
      console.log("Permissions fetch error:", permissionsError);
      return new Response(
        JSON.stringify({ error: `Database error: ${permissionsError.message}` }), 
        { status: 400, headers: corsHeaders }
      );
    }
    
    return new Response(JSON.stringify({ data: permissions }), { headers: {...corsHeaders, "Content-Type": "application/json"} });
  }

  console.log("Fetching user list...");
  
  const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.log("Auth user fetch error:", authError);
    return new Response(
      JSON.stringify({ error: `Database error: ${authError.message}` }), 
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*");
  
  if (profilesError) {
    console.log("Database error on GET profiles:", profilesError);
    return new Response(
      JSON.stringify({ error: `Database error: ${profilesError.message}` }), 
      { status: 400, headers: corsHeaders }
    );
  }
  
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  const combinedUsers = authUsers.map(user => {
    const profile = profilesMap.get(user.id);
    return {
      id: user.id,
      email: user.email,
      name: profile?.name || user.user_metadata?.name || 'N/A',
      role: profile?.role || 'staff',
      status: profile?.status || 'pending',
      avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
      created_at: user.created_at,
    };
  });

  console.log(`Users fetched successfully: ${combinedUsers?.length || 0} users`);
  return new Response(JSON.stringify({ data: combinedUsers }), { headers: {...corsHeaders, "Content-Type": "application/json"} });
}

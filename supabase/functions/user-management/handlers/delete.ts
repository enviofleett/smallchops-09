
import { supabase, corsHeaders } from '../utils.ts';

export async function handleDelete(req: Request, currentUserId: string | null): Promise<Response> {
  const { userId } = await req.json();
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: corsHeaders });
  }

  if (userId === currentUserId) {
    return new Response(JSON.stringify({ error: 'You cannot delete your own account.' }), { status: 400, headers: corsHeaders });
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  
  if (error) {
    console.log("User deletion error:", error);
    return new Response(JSON.stringify({ error: `Failed to delete user: ${error.message}` }), { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ message: 'User deleted successfully' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
}

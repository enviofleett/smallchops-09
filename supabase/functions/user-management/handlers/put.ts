
import { supabase, corsHeaders } from '../utils.ts';

export async function handlePut(req: Request): Promise<Response> {
  const body = await req.json();
  const { userId, status, role } = body;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: corsHeaders });
  }

  const updates: { status?: string, role?: string } = {};
  if (status) updates.status = status;
  if (role) updates.role = role;
  
  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'At least one field (status or role) is required for update' }), { status: 400, headers: corsHeaders });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  
  if (error) {
    console.log("Profile update error:", error);
    return new Response(JSON.stringify({ error: `Failed to update user: ${error.message}` }), { status: 400, headers: corsHeaders });
  }
  
  return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
}

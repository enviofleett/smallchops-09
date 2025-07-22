
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, verifyAdminRole } from './utils.ts';
import { handleGet } from './handlers/get.ts';
import { handlePost } from './handlers/post.ts';
import { handlePut } from './handlers/put.ts';
import { handleDelete } from './handlers/delete.ts';

serve(async (req) => {
  console.log(`User management request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const { isAdmin, userId: currentUserId, error: authError } = await verifyAdminRole(authHeader);

    if (!isAdmin) {
      console.log("Access denied - not admin:", authError);
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }), 
        { status: 403, headers: corsHeaders }
      );
    }

    switch (req.method) {
      case "GET":
        return handleGet(req);
      case "POST":
        return handlePost(req);
      case "PUT":
        return handlePut(req);
      case "DELETE":
        return handleDelete(req, currentUserId);
      default:
        return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }
  } catch (e) {
    console.log("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: `Server error: ${(e as any)?.message || String(e)}` }), 
      { status: 500, headers: corsHeaders }
    );
  }
});

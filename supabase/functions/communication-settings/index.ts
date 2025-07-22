import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helper function to verify admin role
async function verifyAdminRole(authHeader: string | null): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
  if (!authHeader) {
    return { isAdmin: false, userId: null, error: "No authorization header" };
  }

  try {
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      console.log("Auth error:", userError);
      return { isAdmin: false, userId: null, error: "Invalid user token" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log("Profile fetch error:", profileError);
      return { isAdmin: false, userId: user.id, error: "Could not fetch user profile" };
    }

    const isAdmin = profile?.role === "admin";
    console.log(`User ${user.id} admin status: ${isAdmin}`);
    
    return { isAdmin, userId: user.id };
  } catch (error) {
    console.log("Auth verification error:", error);
    return { isAdmin: false, userId: null, error: "Authentication failed" };
  }
}

serve(async (req) => {
  console.log(`Communication settings request: ${req.method} ${req.url}`);

  // Always provide full CORS headers immediately for all paths including errors
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const { isAdmin, userId, error: authError } = await verifyAdminRole(authHeader);

    if (!isAdmin) {
      console.log("Access denied - not admin:", authError);
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required.", details: authError }), 
        { status: 403, headers: corsHeaders }
      );
    }

    if (req.method === "GET") {
      try {
        const { data, error } = await supabase
          .from("communication_settings")
          .select("*")
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (error) {
          console.log("Database error on GET:", error);
          return new Response(
            JSON.stringify({ error: "Database error", details: error.message }),
            { status: 400, headers: corsHeaders }
          );
        }

        return new Response(JSON.stringify({ data }), { headers: corsHeaders });
      } catch (e) {
        console.error('Fatal error in GET /communication-settings:', e);
        return new Response(
          JSON.stringify({ error: "Server error", details: e?.message || String(e) }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    if (req.method === "POST") {
      if (!req.headers.get("content-type")?.includes("application/json")) {
        return new Response(
          JSON.stringify({ error: "Invalid content-type. Must be application/json" }),
          { status: 415, headers: corsHeaders }
        );
      }

      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        console.log("JSON parse error:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body", details: parseError?.message || String(parseError) }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!body || Object.keys(body).length === 0) {
        return new Response(
          JSON.stringify({ error: "Request body cannot be empty" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const updateData = {
        ...body,
        connected_by: userId,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from("communication_settings")
          .upsert([updateData])
          .select()
          .maybeSingle();

        if (error) {
          console.log("Database error on POST:", error);
          return new Response(
            JSON.stringify({ error: "Database error", details: error.message }),
            { status: 400, headers: corsHeaders }
          );
        }

        return new Response(JSON.stringify({ data }), { headers: corsHeaders });
      } catch (e) {
        console.error('Fatal error in POST /communication-settings:', e);
        return new Response(
          JSON.stringify({ error: "Server error", details: e?.message || String(e) }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    console.log("Unexpected error in communication-settings edge function:", e);
    return new Response(
      JSON.stringify({ error: "Server error", details: e?.message || String(e) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

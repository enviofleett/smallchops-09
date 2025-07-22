
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Service role client
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  console.log(`Business settings request: ${req.method} ${req.url}`);

  // Handle preflight for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Use anon client for the user context
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Auth user
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.log("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify admin
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.log("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Could not fetch user profile" }),
        { status: 403, headers: corsHeaders }
      );
    }

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }), 
        { status: 403, headers: corsHeaders }
      );
    }

    // GET: get latest business_settings
    if (req.method === "GET") {
      const { data, error } = await adminClient
        .from("business_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) {
        console.log("Database error on GET:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    // POST: upsert
    if (req.method === "POST") {
      if (!req.headers.get("content-type")?.includes("application/json")) {
        return new Response(
          JSON.stringify({ error: "Request must have 'Content-Type: application/json'" }),
          { status: 415, headers: corsHeaders }
        );
      }
      let body;
      try {
        body = await req.json();
      } catch (parseError) {
        console.log("JSON parse error:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body" }), 
          { status: 400, headers: corsHeaders }
        );
      }
      if (!body || Object.keys(body).length === 0) {
        return new Response(
          JSON.stringify({ error: "Request body cannot be empty" }),
          { status: 400, headers: corsHeaders }
        );
      }
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: "Business name is required" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      const updateData = {
        ...body,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await adminClient
        .from("business_settings")
        .upsert([updateData])
        .select()
        .maybeSingle();

      if (error) {
        console.log("Database error on POST:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    console.log("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: `Server error: ${(e as any)?.message || String(e)}` }), 
      { status: 500, headers: corsHeaders }
    );
  }
});

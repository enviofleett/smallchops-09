
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Service role client for database operations
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
    // Auth validation
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      console.log("No authorization header found");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Use anon client for user context
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.log("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Verify admin role
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
      console.log("Access denied - user is not admin:", profile?.role);
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }), 
        { status: 403, headers: corsHeaders }
      );
    }

    // GET: Retrieve business settings
    if (req.method === "GET") {
      console.log("Fetching business settings");
      const { data, error } = await adminClient
        .from("business_settings")
        .select(`
          id,
          name,
          email,
          address,
          phone,
          working_hours,
          logo_url,
          facebook_url,
          instagram_url,
          tiktok_url,
          created_at,
          updated_at
        `)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.log("Database error on GET:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }
      
      console.log("Business settings retrieved successfully");
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    // POST: Create or update business settings
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
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

      console.log("Creating/updating business settings:", body);
      
      // Prepare the data for upsert - only include fields that exist in the new schema
      const updateData = {
        name: body.name,
        email: body.email || '',
        address: body.address || '',
        phone: body.phone || '',
        working_hours: body.working_hours || '',
        logo_url: body.logo_url || '',
        facebook_url: body.facebook_url || '',
        instagram_url: body.instagram_url || '',
        tiktok_url: body.tiktok_url || '',
        updated_at: new Date().toISOString(),
      };

      console.log("Prepared data for upsert:", updateData);

      const { data, error } = await adminClient
        .from("business_settings")
        .upsert([updateData])
        .select(`
          id,
          name,
          email,
          address,
          phone,
          working_hours,
          logo_url,
          facebook_url,
          instagram_url,
          tiktok_url,
          created_at,
          updated_at
        `)
        .maybeSingle();

      if (error) {
        console.log("Database error on POST:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("Business settings saved successfully:", data);
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

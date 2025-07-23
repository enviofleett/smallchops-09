import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/ // Dev/Preview domains
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://oknnklksdiqaifhxaccs.lovableproject.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

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
  console.log(`Payment integration request: ${req.method} ${req.url}`);
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    const { isAdmin, userId, error: authError } = await verifyAdminRole(authHeader);

    if (!isAdmin) {
      console.log("Access denied - not admin:", authError);
      return new Response(
        JSON.stringify({ error: "Access denied. Admin role required." }), 
        { status: 403, headers: corsHeaders }
      );
    }

    if (req.method === "GET") {
      console.log("Fetching payment integration settings...");
      const { data, error } = await supabase
        .from("payment_integrations")
        .select("*")
        .ilike("provider", "paystack")
        .order("created_at", { ascending: false })
        .maybeSingle();
        
      if (error) {
        console.log("Database error on GET:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("Payment settings fetched successfully:", data ? "found" : "none");
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    if (req.method === "POST") {
      console.log("Updating payment integration settings...");

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
      
      if (!body.provider) {
        return new Response(
          JSON.stringify({ error: "Provider is required" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      const updateData = {
        ...body,
        connected_by: userId,
        updated_at: new Date().toISOString(),
      };

      console.log("Upserting payment data:", updateData);
      
      const { data, error } = await supabase
        .from("payment_integrations")
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

      console.log("Payment settings updated successfully");
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

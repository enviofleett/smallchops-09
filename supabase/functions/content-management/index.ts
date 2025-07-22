
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
  console.log(`Content management request: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    // Public endpoint for published content (no auth required)
    if (pathSegments.includes('public')) {
      if (req.method === "GET") {
        const contentType = url.searchParams.get("type");
        const slug = url.searchParams.get("slug");
        
        let query = supabase
          .from("site_content")
          .select("*")
          .eq("is_published", true);
        
        if (contentType) {
          query = query.eq("content_type", contentType);
        }
        
        if (slug) {
          query = query.eq("slug", slug);
        }
        
        const { data, error } = await query.order("updated_at", { ascending: false });
        
        if (error) {
          console.log("Database error on public GET:", error);
          return new Response(
            JSON.stringify({ error: `Database error: ${error.message}` }), 
            { status: 400, headers: corsHeaders }
          );
        }

        console.log("Public content fetched successfully");
        return new Response(JSON.stringify({ data }), { headers: corsHeaders });
      }
    }
    
    // Admin endpoints - require authentication
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
      const contentId = url.searchParams.get("id");
      const includeVersions = url.searchParams.get("versions") === "true";
      
      if (contentId) {
        // Get specific content with optional versions
        let query = supabase
          .from("site_content")
          .select("*")
          .eq("id", contentId)
          .single();
        
        const { data: content, error } = await query;
        
        if (error) {
          console.log("Database error on GET content:", error);
          return new Response(
            JSON.stringify({ error: `Database error: ${error.message}` }), 
            { status: 400, headers: corsHeaders }
          );
        }

        let versions = null;
        if (includeVersions) {
          const { data: versionData, error: versionError } = await supabase
            .from("content_versions")
            .select("*")
            .eq("content_id", contentId)
            .order("created_at", { ascending: false });
          
          if (!versionError) {
            versions = versionData;
          }
        }

        return new Response(JSON.stringify({ data: content, versions }), { headers: corsHeaders });
      } else {
        // Get all content
        const { data, error } = await supabase
          .from("site_content")
          .select("*")
          .order("updated_at", { ascending: false });
        
        if (error) {
          console.log("Database error on GET all:", error);
          return new Response(
            JSON.stringify({ error: `Database error: ${error.message}` }), 
            { status: 400, headers: corsHeaders }
          );
        }

        console.log("All content fetched successfully");
        return new Response(JSON.stringify({ data }), { headers: corsHeaders });
      }
    }

    if (req.method === "POST") {
      console.log("Creating new content...");
      let body;
      
      try {
        const rawBody = await req.text();
        console.log("Raw request body:", rawBody);
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.log("JSON parse error:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      const insertData = {
        ...body,
        created_by: userId,
        updated_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log("Inserting content data:", insertData);
      
      const { data, error } = await supabase
        .from("site_content")
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.log("Database error on POST:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("Content created successfully");
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    if (req.method === "PUT") {
      console.log("Updating content...");
      const contentId = url.searchParams.get("id");
      
      if (!contentId) {
        return new Response(
          JSON.stringify({ error: "Content ID is required for updates" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      let body;
      
      try {
        const rawBody = await req.text();
        console.log("Raw request body:", rawBody);
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.log("JSON parse error:", parseError);
        return new Response(
          JSON.stringify({ error: "Invalid JSON in request body" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      // Increment version number
      const { data: currentContent } = await supabase
        .from("site_content")
        .select("version")
        .eq("id", contentId)
        .single();

      const updateData = {
        ...body,
        updated_by: userId,
        updated_at: new Date().toISOString(),
        version: (currentContent?.version || 1) + 1,
        published_at: body.is_published ? new Date().toISOString() : null,
        unpublished_at: !body.is_published ? new Date().toISOString() : null,
      };

      console.log("Updating content data:", updateData);
      
      const { data, error } = await supabase
        .from("site_content")
        .update(updateData)
        .eq("id", contentId)
        .select()
        .single();

      if (error) {
        console.log("Database error on PUT:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("Content updated successfully");
      return new Response(JSON.stringify({ data }), { headers: corsHeaders });
    }

    if (req.method === "DELETE") {
      console.log("Deleting content...");
      const contentId = url.searchParams.get("id");
      
      if (!contentId) {
        return new Response(
          JSON.stringify({ error: "Content ID is required for deletion" }), 
          { status: 400, headers: corsHeaders }
        );
      }

      const { error } = await supabase
        .from("site_content")
        .delete()
        .eq("id", contentId);

      if (error) {
        console.log("Database error on DELETE:", error);
        return new Response(
          JSON.stringify({ error: `Database error: ${error.message}` }), 
          { status: 400, headers: corsHeaders }
        );
      }

      console.log("Content deleted successfully");
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
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

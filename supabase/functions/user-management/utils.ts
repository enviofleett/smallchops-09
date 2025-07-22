
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helper function to verify admin role
export async function verifyAdminRole(authHeader: string | null): Promise<{ isAdmin: boolean; userId: string | null; error?: string }> {
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

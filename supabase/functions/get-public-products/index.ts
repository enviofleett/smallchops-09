
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/, // Dev/Preview domains
    /^https:\/\/[\w-]+\.lovable\.dev$/ // lovable.dev domains
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

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Query string for optional ?q=searchterm
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase();

  // Supabase client for edge functions
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.50.0");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from("products")
    .select(
      `
      id, name, description, price, sku, image_url, stock_quantity, status,
      features, is_promotional, preparation_time, allergen_info,
      category_id,
      categories ( id, name )
      `
    )
    .eq("status", "active")
    .gt("stock_quantity", 0);

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,description.ilike.%${q}%,sku.ilike.%${q}%`
    );
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify(data ?? []),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

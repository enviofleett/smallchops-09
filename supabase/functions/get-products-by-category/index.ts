
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("category_id");

  if (!categoryId) {
    return new Response(
      JSON.stringify({ error: "Missing category_id parameter" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.50.0");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("products")
    .select(
      `
      id, name, description, price, sku, image_url, stock_quantity, status,
      category_id,
      categories ( id, name )
      `
    )
    .eq("status", "active")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

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

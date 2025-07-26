import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMITS = {
  favorites: { requests: 60, window: 60000 }, // 60 requests per minute
  general: { requests: 100, window: 60000 }, // 100 requests per minute
  auth: { requests: 10, window: 60000 }, // 10 requests per minute for auth operations
};

// Helper function to check rate limits
async function checkRateLimit(supabase: any, identifier: string, endpoint: string, limit: any) {
  const windowStart = new Date(Date.now() - limit.window);
  
  // Clean up old entries
  await supabase
    .from('api_rate_limits')
    .delete()
    .lt('window_start', windowStart.toISOString());

  // Check current count
  const { data: existing, error } = await supabase
    .from('api_rate_limits')
    .select('request_count')
    .eq('identifier', identifier)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }

  const currentCount = existing?.request_count || 0;

  if (currentCount >= limit.requests) {
    return false; // Rate limit exceeded
  }

  // Update or insert rate limit record
  await supabase
    .from('api_rate_limits')
    .upsert({
      identifier,
      endpoint,
      request_count: currentCount + 1,
      window_start: new Date().toISOString(),
    }, {
      onConflict: 'identifier,endpoint,window_start',
    });

  return true;
}

// Helper function to get client IP
function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

// Helper function to validate customer authentication
async function validateCustomerAuth(supabase: any, authHeader: string | null): Promise<{ userId: string; customerId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const jwt = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(jwt);
    
    if (error || !user) {
      return null;
    }

    // Get customer account
    const { data: customerAccount, error: accountError } = await supabase
      .from('customer_accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !customerAccount) {
      return null;
    }

    return {
      userId: user.id,
      customerId: customerAccount.id,
    };
  } catch (error) {
    console.error('Auth validation error:', error);
    return null;
  }
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PUBLIC-API] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const clientIP = getClientIP(req);
    const authHeader = req.headers.get('authorization');

    logStep("Public API request", { method, path, ip: clientIP });

    // Create Supabase client with anon key for proper RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );

    // Set auth context if provided
    if (authHeader?.startsWith('Bearer ')) {
      await supabaseClient.auth.setSession({
        access_token: authHeader.substring(7),
        refresh_token: '',
      });
    }

    // Rate limiting check
    const endpoint = path.split('/')[1] || 'general';
    const rateLimit = RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS] || RATE_LIMITS.general;
    
    const rateLimitPassed = await checkRateLimit(supabaseClient, clientIP, endpoint, rateLimit);
    if (!rateLimitPassed) {
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }),
        { 
          status: 429, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Route handling for customer favorites (requires authentication)
    if (path.startsWith("/customers/") && path.includes("/favorites")) {
      const auth = await validateCustomerAuth(supabaseClient, authHeader);
      if (!auth) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication required" }),
          { 
            status: 401, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      const pathParts = path.split('/');
      const requestedCustomerId = pathParts[2];

      // Ensure customer can only access their own data
      if (requestedCustomerId !== auth.customerId) {
        return new Response(
          JSON.stringify({ success: false, error: "Access denied" }),
          { 
            status: 403, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      // GET /customers/:id/favorites
      if (method === "GET" && pathParts.length === 4 && pathParts[3] === "favorites") {
        const { data: favorites, error } = await supabaseClient
          .from('customer_favorites')
          .select(`
            id,
            created_at,
            products!inner (
              *,
              categories (
                id,
                name
              )
            )
          `)
          .eq('customer_id', auth.customerId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching customer favorites:', error);
          return new Response(JSON.stringify({ success: false, error: 'Failed to fetch favorites' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const favoriteProducts = favorites?.map(favorite => ({
          ...favorite.products,
          favorite_id: favorite.id,
          favorited_at: favorite.created_at,
        })) || [];

        return new Response(JSON.stringify({ success: true, data: favoriteProducts }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /customers/:id/favorites
      if (method === "POST" && pathParts.length === 4 && pathParts[3] === "favorites") {
        const { product_id } = await req.json();

        if (!product_id) {
          return new Response(JSON.stringify({ success: false, error: 'product_id is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { data, error } = await supabaseClient
          .from('customer_favorites')
          .insert({
            customer_id: auth.customerId,
            product_id: product_id,
          })
          .select()
          .single();

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            return new Response(JSON.stringify({ success: false, error: 'Product is already in favorites' }), {
              status: 409,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          console.error('Error adding to favorites:', error);
          return new Response(JSON.stringify({ success: false, error: 'Failed to add to favorites' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true, data }), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // DELETE /customers/:id/favorites/:product_id
      if (method === "DELETE" && pathParts.length === 5 && pathParts[3] === "favorites") {
        const productId = pathParts[4];

        const { error } = await supabaseClient
          .from('customer_favorites')
          .delete()
          .eq('customer_id', auth.customerId)
          .eq('product_id', productId);

        if (error) {
          console.error('Error removing from favorites:', error);
          return new Response(JSON.stringify({ success: false, error: 'Failed to remove from favorites' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(null, {
          status: 204,
          headers: corsHeaders
        });
      }
    }

    // Public endpoints (no authentication required)
    if (method === "GET" && path === "/categories") {
      // Get all active categories
      const { data: categories, error } = await supabaseClient
        .from('categories')
        .select('id, name, slug, description, banner_url, sort_order')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: categories }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "GET" && path === "/products") {
      // Get all active products with category info
      const categoryId = url.searchParams.get('category_id');
      
      let query = supabaseClient
        .from('products')
        .select(`
          id, name, description, price, image_url, sku, stock_quantity,
          category_id, nutritional_info,
          categories (id, name, slug)
        `)
        .eq('status', 'active');

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data: products, error } = await query.order('name');

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: products }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "GET" && path === "/promotions") {
      // Get active promotions
      const { data: promotions, error } = await supabaseClient
        .from('promotions')
        .select('id, name, code, type, value, description, min_order_amount, max_discount_amount')
        .eq('status', 'active')
        .lte('valid_from', new Date().toISOString())
        .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString());

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: promotions }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default 404 response
    return new Response(
      JSON.stringify({ success: false, error: "Endpoint not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in public-api", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
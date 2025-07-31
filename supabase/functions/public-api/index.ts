import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// PRODUCTION CORS - No wildcards
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const isDev = Deno.env.get('DENO_ENV') === 'development';
  
  if (isDev) {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isDev ? '*' : 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
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

    // POST /customers - Customer registration
    if (method === "POST" && path === "/customers") {
      const { name, email, phone, date_of_birth } = await req.json();

      // Validate required fields
      if (!name || !email) {
        return new Response(
          JSON.stringify({ success: false, error: "Name and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid email format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Check if customer already exists
        const { data: existingCustomer } = await supabaseClient
          .from('customers')
          .select('id')
          .eq('email', email)
          .single();

        if (existingCustomer) {
          return new Response(
            JSON.stringify({ success: true, data: { id: existingCustomer.id, existing: true } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create new customer
        const { data: customer, error } = await supabaseClient
          .from('customers')
          .insert({
            name,
            email,
            phone,
            date_of_birth
          })
          .select('id, name, email, phone')
          .single();

        if (error) {
          console.error('Error creating customer:', error);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create customer" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Customer created", { id: customer.id, email });
        return new Response(
          JSON.stringify({ success: true, data: customer }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error('Error in customer registration:', error);
        return new Response(
          JSON.stringify({ success: false, error: "Registration failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST /orders - Order creation
    if (method === "POST" && path === "/orders") {
      const orderData = await req.json();
      const {
        customer_name,
        customer_email,
        customer_phone,
        order_type,
        delivery_address,
        special_instructions,
        promotion_code,
        items,
        subtotal,
        tax_amount,
        delivery_fee,
        discount_amount,
        total_amount
      } = orderData;

      // Validate required fields
      if (!customer_name || !customer_email || !customer_phone || !items || items.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required order information" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (order_type === 'delivery' && !delivery_address) {
        return new Response(
          JSON.stringify({ success: false, error: "Delivery address is required for delivery orders" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Generate order number
        const { data: orderNumber } = await supabaseClient.rpc('generate_order_number');

        // Create order with atomic transaction
        const { data: order, error: orderError } = await supabaseClient
          .from('orders')
          .insert({
            order_number: orderNumber,
            customer_name,
            customer_email,
            customer_phone,
            order_type: order_type || 'delivery',
            delivery_address,
            special_instructions,
            subtotal: subtotal || 0,
            tax_amount: tax_amount || 0,
            delivery_fee: delivery_fee || 0,
            discount_amount: discount_amount || 0,
            total_amount: total_amount || 0,
            status: 'pending',
            payment_status: 'pending'
          })
          .select('id, order_number')
          .single();

        if (orderError) {
          console.error('Error creating order:', orderError);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create order" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create order items
        const orderItems = items.map((item: any) => ({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          customizations: item.customizations,
          special_instructions: item.special_instructions
        }));

        const { error: itemsError } = await supabaseClient
          .from('order_items')
          .insert(orderItems);

        if (itemsError) {
          console.error('Error creating order items:', itemsError);
          // Clean up order if items creation fails
          await supabaseClient.from('orders').delete().eq('id', order.id);
          return new Response(
            JSON.stringify({ success: false, error: "Failed to create order items" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("Order created", { id: order.id, orderNumber: order.order_number });
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              id: order.id, 
              order_number: order.order_number,
              status: 'pending',
              total_amount 
            } 
          }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error('Error in order creation:', error);
        return new Response(
          JSON.stringify({ success: false, error: "Order creation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // GET /orders/:id - Order tracking  
    if (method === "GET" && path.startsWith("/orders/")) {
      const orderIdOrNumber = path.split('/')[2];
      
      if (!orderIdOrNumber) {
        return new Response(
          JSON.stringify({ success: false, error: "Order ID or number is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Try to find order by ID first, then by order number
        let query = supabaseClient
          .from('orders')
          .select(`
            id, order_number, status, payment_status, order_type,
            customer_name, customer_email, customer_phone,
            delivery_address, special_instructions,
            subtotal, tax_amount, delivery_fee, discount_amount, total_amount,
            order_time, delivery_time, pickup_time,
            order_items (
              id, product_id, product_name, quantity, unit_price, total_price,
              customizations, special_instructions
            )
          `);

        // Check if it's a UUID (order ID) or order number
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
        
        if (isUUID) {
          query = query.eq('id', orderIdOrNumber);
        } else {
          query = query.eq('order_number', orderIdOrNumber);
        }

        const { data: order, error } = await query.single();

        if (error || !order) {
          return new Response(
            JSON.stringify({ success: false, error: "Order not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate estimated delivery/pickup time based on status
        let estimated_time = null;
        if (order.status !== 'delivered' && order.status !== 'cancelled') {
          const baseTime = new Date();
          switch (order.status) {
            case 'pending':
            case 'confirmed':
              baseTime.setMinutes(baseTime.getMinutes() + 45);
              break;
            case 'preparing':
              baseTime.setMinutes(baseTime.getMinutes() + 30);
              break;
            case 'ready':
              if (order.order_type === 'pickup') {
                estimated_time = 'Ready for pickup';
              } else {
                baseTime.setMinutes(baseTime.getMinutes() + 15);
              }
              break;
            case 'out_for_delivery':
              baseTime.setMinutes(baseTime.getMinutes() + 15);
              break;
          }
          if (estimated_time !== 'Ready for pickup') {
            estimated_time = baseTime.toISOString();
          }
        }

        const response = {
          ...order,
          estimated_time,
          tracking_steps: [
            { status: 'pending', label: 'Order Received', completed: true },
            { status: 'confirmed', label: 'Order Confirmed', completed: ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) },
            { status: 'preparing', label: 'Preparing Your Order', completed: ['preparing', 'ready', 'out_for_delivery', 'delivered'].includes(order.status) },
            { status: 'ready', label: order.order_type === 'pickup' ? 'Ready for Pickup' : 'Ready for Delivery', completed: ['ready', 'out_for_delivery', 'delivered'].includes(order.status) },
            ...(order.order_type === 'delivery' ? [{ status: 'out_for_delivery', label: 'Out for Delivery', completed: ['out_for_delivery', 'delivered'].includes(order.status) }] : []),
            { status: 'delivered', label: order.order_type === 'pickup' ? 'Picked Up' : 'Delivered', completed: order.status === 'delivered' }
          ]
        };

        return new Response(
          JSON.stringify({ success: true, data: response }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error('Error fetching order:', error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch order" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // POST /validate-promotion - Promotion code validation
    if (method === "POST" && path === "/validate-promotion") {
      const { code, order_amount } = await req.json();

      if (!code || order_amount === undefined) {
        return new Response(
          JSON.stringify({ success: false, error: "Promotion code and order amount are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Find active promotion
        const { data: promotion, error } = await supabaseClient
          .from('promotions')
          .select('*')
          .eq('code', code.toUpperCase())
          .eq('status', 'active')
          .lte('valid_from', new Date().toISOString())
          .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString())
          .single();

        if (error || !promotion) {
          return new Response(
            JSON.stringify({ success: false, error: "Invalid or expired promotion code" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check minimum order amount
        if (promotion.min_order_amount && order_amount < promotion.min_order_amount) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Minimum order amount of $${promotion.min_order_amount} required for this promotion` 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate discount
        let discount_amount = 0;
        if (promotion.type === 'percentage') {
          discount_amount = (order_amount * promotion.value) / 100;
          if (promotion.max_discount_amount) {
            discount_amount = Math.min(discount_amount, promotion.max_discount_amount);
          }
        } else if (promotion.type === 'fixed') {
          discount_amount = Math.min(promotion.value, order_amount);
        }

        discount_amount = Math.round(discount_amount * 100) / 100; // Round to 2 decimals

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: {
              promotion_id: promotion.id,
              code: promotion.code,
              type: promotion.type,
              value: promotion.value,
              discount_amount,
              description: promotion.description
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.error('Error validating promotion:', error);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to validate promotion" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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
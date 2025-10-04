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

    // Create Supabase client with service role for secure operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create anon client for public operations
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

    // Enhanced rate limiting using secure function
    const endpoint = path.split('/')[1] || 'general';
    const rateLimitConfig = {
      favorites: { requests: 60, window: 60 },
      general: { requests: 100, window: 60 },
      auth: { requests: 10, window: 60 },
      orders: { requests: 50, window: 60 }, // Limit order tracking
    };
    
    const limit = rateLimitConfig[endpoint as keyof typeof rateLimitConfig] || rateLimitConfig.general;
    
    // Use secure rate limiting function
    const { data: rateLimitResult, error: rateLimitError } = await serviceClient.rpc(
      'increment_api_rate_limit',
      {
        p_identifier: clientIP,
        p_endpoint: endpoint,
        p_max_requests: limit.requests,
        p_window_minutes: limit.window
      }
    );

    if (rateLimitError) {
      console.error('Rate limit check failed:', rateLimitError);
      // Fail closed - deny access if rate limiting fails
      return new Response(
        JSON.stringify({ success: false, error: "Service temporarily unavailable" }),
        { 
          status: 503, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (!rateLimitResult?.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded. Please try again later.",
          retry_after: rateLimitResult?.reset_at
        }),
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
          if (error.code === '23505') {
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

    // GET /orders/:id - SECURED Order tracking with limited PII exposure
    if (method === "GET" && path.startsWith("/orders/")) {
      const orderIdOrNumber = path.split('/')[2];
      const accessToken = url.searchParams.get('token'); // Optional access token
      
      if (!orderIdOrNumber) {
        return new Response(
          JSON.stringify({ success: false, error: "Order ID or number is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Check if it's a UUID (order ID) or order number
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderIdOrNumber);
        
        let query = supabaseClient.from('orders');
        
        if (isUUID) {
          query = query.eq('id', orderIdOrNumber);
        } else {
          query = query.eq('order_number', orderIdOrNumber);
        }

        // Determine access level
        const auth = await validateCustomerAuth(supabaseClient, authHeader);
        const hasValidToken = accessToken && await serviceClient.rpc('validate_order_access_token', {
          p_order_id: isUUID ? orderIdOrNumber : null,
          p_token: accessToken
        });

        const isAuthenticated = auth || hasValidToken;

        if (isAuthenticated) {
          // Full access for authenticated users or valid token holders
          query = query.select(`
            id, order_number, status, payment_status, order_type,
            customer_name, customer_email, customer_phone,
            delivery_address, delivery_zone_id, special_instructions,
            subtotal, tax_amount, delivery_fee, discount_amount, total_amount,
            order_time, delivery_time, pickup_time,
            delivery_zones (
              id, name, description
            ),
            order_items (
              id, product_id, product_name, quantity, unit_price, total_price,
              customizations, special_instructions
            )
          `);
        } else {
          // LIMITED PUBLIC ACCESS - No PII, only tracking info
          query = query.select(`
            id, order_number, status, order_type, total_amount, 
            order_time, delivery_time, pickup_time
          `);
        }

        const { data: order, error } = await query.single();

        if (error || !order) {
          // Log potential unauthorized access attempts
          await serviceClient.rpc('log_security_event', {
            p_event_type: 'unauthorized_order_access_attempt',
            p_severity: 'medium',
            p_description: `Failed order access attempt for ${orderIdOrNumber}`,
            p_metadata: { 
              order_identifier: orderIdOrNumber,
              ip_address: clientIP,
              has_auth: !!auth,
              has_token: !!accessToken
            }
          });

          return new Response(
            JSON.stringify({ success: false, error: "Order not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Calculate estimated time
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
          ],
          access_level: isAuthenticated ? 'full' : 'public'
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
      const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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

    // POST /orders - Order creation with access token generation
    if (method === "POST" && path === "/orders") {
      const orderData = await req.json();
      const {
        customer_name,
        customer_email,
        customer_phone,
        order_type,
        delivery_address,
        delivery_zone_id,
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
        // CRITICAL: Validate MOQ requirements before creating order
        const moqValidationItems = items.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity
        }));

        const moqResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-moq-requirements`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
            },
            body: JSON.stringify({ items: moqValidationItems })
          }
        );

        const moqResult = await moqResponse.json();

        if (!moqResult.success || !moqResult.valid) {
          logStep("MOQ validation failed", { violations: moqResult.violations });
          return new Response(
            JSON.stringify({
              success: false,
              error: "Minimum order quantity requirements not met",
              violations: moqResult.violations
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("MOQ validation passed", { itemCount: items.length });
        // Generate order number using service client
        const { data: orderNumber } = await serviceClient.rpc('generate_order_number');

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
            delivery_zone_id: delivery_zone_id || null,
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

        // Generate secure access token for order tracking
        const { data: accessToken } = await serviceClient.rpc('generate_order_access_token', {
          p_order_id: order.id
        });

        logStep("Order created with access token", { id: order.id, orderNumber: order.order_number });
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              id: order.id, 
              order_number: order.order_number,
              status: 'pending',
              total_amount,
              access_token: accessToken // Provide secure access token for tracking
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

    if (method === "GET" && path === "/categories") {
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

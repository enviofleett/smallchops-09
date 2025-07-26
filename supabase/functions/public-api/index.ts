import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    logStep("Public API request", { method, path });

    // Create Supabase client with service role for unrestricted access
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Route handling
    // GET /customers/:id/favorites
    if (method === "GET" && path.startsWith("/customers/") && path.includes("/favorites")) {
      const pathParts = path.split('/');
      if (pathParts.length === 4 && pathParts[3] === "favorites") {
        const customerId = pathParts[2];
        
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
          .eq('customer_id', customerId)
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
    }

    // POST /customers/:id/favorites
    if (method === "POST" && path.startsWith("/customers/") && path.includes("/favorites")) {
      const pathParts = path.split('/');
      if (pathParts.length === 4 && pathParts[3] === "favorites") {
        const customerId = pathParts[2];
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
            customer_id: customerId,
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
    }

    // DELETE /customers/:id/favorites/:product_id
    if (method === "DELETE" && path.startsWith("/customers/") && path.includes("/favorites/")) {
      const pathParts = path.split('/');
      if (pathParts.length === 5 && pathParts[3] === "favorites") {
        const customerId = pathParts[2];
        const productId = pathParts[4];

        const { error } = await supabaseClient
          .from('customer_favorites')
          .delete()
          .eq('customer_id', customerId)
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

    if (method === "POST" && path === "/customers") {
      // Register new customer
      const { name, email, phone, date_of_birth } = await req.json();

      if (!name || !email) {
        return new Response(
          JSON.stringify({ success: false, error: "Name and email are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if customer already exists
      const { data: existingCustomer } = await supabaseClient
        .from('customers')
        .select('id, name, email')
        .eq('email', email)
        .single();

      if (existingCustomer) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            data: existingCustomer,
            message: "Customer already exists" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create new customer
      const { data: newCustomer, error } = await supabaseClient
        .from('customers')
        .insert([{ name, email, phone, date_of_birth }])
        .select()
        .single();

      if (error) throw error;

      // Send welcome email
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            to: email,
            toName: name,
            subject: "Welcome to Our Restaurant!",
            template: 'welcome',
            variables: { customerName: name }
          })
        });
        logStep("Welcome email sent to new customer");
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }

      return new Response(
        JSON.stringify({ success: true, data: newCustomer }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST" && path === "/orders") {
      // Create new order
      const orderData = await req.json();
      const {
        customer_name,
        customer_email,
        customer_phone,
        order_type = 'delivery',
        delivery_address,
        special_instructions,
        items,
        promotion_code,
        subtotal,
        tax_amount,
        delivery_fee = 0,
        discount_amount = 0,
        total_amount
      } = orderData;

      if (!customer_name || !customer_email || !customer_phone || !items || !Array.isArray(items) || items.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Missing required fields: customer_name, customer_email, customer_phone, items" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate order number
      const { data: orderCountData } = await supabaseClient
        .from('orders')
        .select('id', { count: 'exact' });
      
      const orderCount = (orderCountData?.length || 0) + 1;
      const orderNumber = `ORD${orderCount.toString().padStart(6, '0')}`;

      // Create the order
      const { data: newOrder, error: orderError } = await supabaseClient
        .from('orders')
        .insert([{
          order_number: orderNumber,
          customer_name,
          customer_email,
          customer_phone,
          order_type,
          delivery_address,
          special_instructions,
          subtotal: subtotal || 0,
          tax_amount: tax_amount || 0,
          delivery_fee,
          discount_amount: discount_amount || 0,
          total_amount: total_amount || subtotal || 0,
          status: 'pending',
          payment_status: 'pending'
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Add order items
      const orderItems = items.map((item: any) => ({
        order_id: newOrder.id,
        product_id: item.product_id,
        product_name: item.product_name || item.name,
        quantity: item.quantity,
        unit_price: item.unit_price || item.price,
        total_price: item.total_price || (item.quantity * (item.unit_price || item.price)),
        special_instructions: item.special_instructions,
        customizations: item.customizations
      }));

      const { error: itemsError } = await supabaseClient
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      logStep("Order created successfully", { orderNumber, totalAmount: total_amount });

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            ...newOrder,
            items: orderItems
          }
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "GET" && path.startsWith("/orders/")) {
      // Get order by ID or order number
      const orderId = path.split('/')[2];
      
      let query = supabaseClient
        .from('orders')
        .select(`
          *,
          order_items (
            id, product_id, product_name, quantity, unit_price, total_price,
            special_instructions, customizations
          )
        `);

      // Check if it's a UUID (order ID) or order number
      if (orderId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        query = query.eq('id', orderId);
      } else {
        query = query.eq('order_number', orderId);
      }

      const { data: order, error } = await query.single();

      if (error || !order) {
        return new Response(
          JSON.stringify({ success: false, error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: order }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (method === "POST" && path === "/validate-promotion") {
      // Validate promotion code
      const { code, order_amount } = await req.json();

      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: "Promotion code is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

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
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check minimum order amount
      if (promotion.min_order_amount && order_amount < promotion.min_order_amount) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Minimum order amount of $${promotion.min_order_amount} required` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate discount
      let discountAmount = 0;
      if (promotion.type === 'percentage') {
        discountAmount = (order_amount * promotion.value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
      } else if (promotion.type === 'fixed_amount') {
        discountAmount = promotion.value;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            ...promotion,
            discount_amount: discountAmount
          }
        }),
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
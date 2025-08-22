import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Production CORS headers with proper security
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // TODO: Replace with specific domains in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
};

// Validate environment variables with proper error handling
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing required environment variables");
  throw new Error("Missing Supabase environment variables");
}

// Validate URL format
try {
  new URL(SUPABASE_URL);
} catch {
  throw new Error("Invalid SUPABASE_URL format");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Input validation schemas
interface CustomerInput {
  name?: string;
  email: string;
  phone?: string;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  customizations?: Record<string, any>;
}

interface FulfillmentInput {
  type: 'delivery' | 'pickup';
  address?: string;
  pickup_point_id?: string;
  delivery_zone_id?: string;
}

interface CheckoutRequest {
  customer: CustomerInput;
  items: OrderItem[];
  fulfillment: FulfillmentInput;
}

// Validation functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validateCustomer(customer: CustomerInput): void {
  if (!customer?.email) {
    throw new Error("Customer email is required");
  }
  
  if (!validateEmail(customer.email)) {
    throw new Error("Invalid email format");
  }
  
  if (customer.name && (customer.name.length < 2 || customer.name.length > 100)) {
    throw new Error("Customer name must be between 2 and 100 characters");
  }
  
  if (customer.phone && !/^\+?[\d\s\-\(\)]{10,20}$/.test(customer.phone)) {
    throw new Error("Invalid phone number format");
  }
}

function validateItems(items: OrderItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }
  
  if (items.length > 50) {
    throw new Error("Order cannot exceed 50 items");
  }
  
  for (const [index, item] of items.entries()) {
    if (!item.product_id || typeof item.product_id !== 'string') {
      throw new Error(`Item ${index + 1}: Invalid product_id`);
    }
    
    if (!item.product_name || typeof item.product_name !== 'string') {
      throw new Error(`Item ${index + 1}: Invalid product_name`);
    }
    
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw new Error(`Item ${index + 1}: Quantity must be between 1 and 100`);
    }
    
    if (typeof item.unit_price !== 'number' || item.unit_price <= 0 || item.unit_price > 1000000) {
      throw new Error(`Item ${index + 1}: Invalid unit_price`);
    }
  }
}

function validateFulfillment(fulfillment: FulfillmentInput): void {
  if (!fulfillment?.type) {
    throw new Error("Fulfillment type is required");
  }
  
  if (!['delivery', 'pickup'].includes(fulfillment.type)) {
    throw new Error("Fulfillment type must be 'delivery' or 'pickup'");
  }
  
  if (fulfillment.type === 'delivery' && !fulfillment.address) {
    throw new Error("Delivery address is required for delivery orders");
  }
  
  if (fulfillment.type === 'pickup' && !fulfillment.pickup_point_id) {
    throw new Error("Pickup point is required for pickup orders");
  }
  
  if (fulfillment.address && fulfillment.address.length > 500) {
    throw new Error("Address cannot exceed 500 characters");
  }
}

// Enhanced error handling with proper HTTP status codes
function createErrorResponse(error: any, status: number = 400) {
  const errorMessage = error?.message || "Internal server error";
  const errorType = error?.constructor?.name || "Error";
  
  console.error(`❌ [${status}] ${errorType}:`, errorMessage);
  
  return new Response(JSON.stringify({
    success: false,
    error: errorMessage,
    details: {
      timestamp: new Date().toISOString(),
      error_type: errorType
    }
  }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

// Retry mechanism for database operations
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxRetries: number = 2,
  delayMs: number = 100
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry validation errors or client errors
      if (error?.message?.includes('required') || 
          error?.message?.includes('Invalid') ||
          error?.code === '23514') { // Check constraint violation
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, error?.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }
  
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  
  // Only allow POST requests
  if (req.method !== "POST") {
    return createErrorResponse(new Error("Method not allowed"), 405);
  }
  
  let requestBody: CheckoutRequest;
  
  try {
    console.log("🛒 Processing checkout request...");
    
    // Parse and validate JSON with size limit
    const rawBody = await req.text();
    if (rawBody.length > 50000) { // 50KB limit
      throw new Error("Request body too large");
    }
    
    requestBody = JSON.parse(rawBody);
    
    console.log("📨 Checkout request received:", {
      customer_email: requestBody.customer?.email,
      items_count: requestBody.items?.length,
      fulfillment_type: requestBody.fulfillment?.type
    });

    // Input validation
    validateCustomer(requestBody.customer);
    validateItems(requestBody.items);
    validateFulfillment(requestBody.fulfillment);

    const customerEmail = requestBody.customer.email.toLowerCase().trim();
    let customerId: string;

    // Customer lookup/creation with proper error handling
    console.log("👤 Looking up customer by email:", customerEmail);
    
    const { data: existingCustomer, error: findError } = await withRetry(
      () => supabaseAdmin
        .from("customer_accounts")
        .select("id, name")
        .eq("email", customerEmail)
        .maybeSingle()
    );

    if (findError) {
      console.error("❌ Failed to check for existing customer:", findError);
      throw new Error("Failed to find customer account");
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log("👤 Using existing customer:", customerId);
    } else {
      // Create new customer with proper error handling
      console.log("👤 Creating new customer account for:", customerEmail);
      
      const { data: newCustomer, error: createError } = await withRetry(
        () => supabaseAdmin
          .from("customer_accounts")
          .insert({
            name: requestBody.customer.name?.trim() || null,
            email: customerEmail,
            phone: requestBody.customer.phone?.trim() || null,
            email_verified: false,
            phone_verified: false,
            profile_completion_percentage: requestBody.customer.name ? 60 : 40
          })
          .select("id")
          .single()
      );

      if (createError) {
        if (createError.code === "23505") { // Unique constraint violation
          console.log("⚠️ Race condition detected. Fetching existing customer...");
          
          const { data: raceCustomer, error: raceError } = await supabaseAdmin
            .from("customer_accounts")
            .select("id")
            .eq("email", customerEmail)
            .single();
          
          if (raceError || !raceCustomer) {
            console.error("❌ Failed to resolve customer after race condition:", raceError);
            throw new Error("Failed to resolve customer account");
          }
          
          customerId = raceCustomer.id;
          console.log("👤 Resolved race condition, using existing customer:", customerId);
        } else {
          console.error("❌ Customer creation failed:", createError);
          throw new Error(`Failed to create customer: ${createError.message}`);
        }
      } else {
        customerId = newCustomer.id;
        console.log("👤 Created new customer:", customerId);
      }
    }

    // Prepare order items with validation
    console.log("📝 Creating order with items...");
    
    const orderItems = requestBody.items.map((item, index) => {
      // Additional validation for calculated fields
      const lineTotal = item.quantity * item.unit_price;
      if (lineTotal > 1000000) { // 1M maximum per line item
        throw new Error(`Item ${index + 1}: Line total exceeds maximum allowed`);
      }
      
      return {
        product_id: item.product_id.trim(),
        product_name: item.product_name.trim(),
        quantity: item.quantity,
        unit_price: Math.round(item.unit_price * 100) / 100, // Round to 2 decimal places
        customizations: item.customizations || null
      };
    });

    // Calculate and validate total
    const calculatedTotal = orderItems.reduce(
      (sum, item) => sum + (item.quantity * item.unit_price), 
      0
    );
    
    if (calculatedTotal > 1000000) {
      throw new Error("Order total exceeds maximum allowed amount");
    }

    // Create order with proper error handling
    const { data: orderId, error: orderError } = await withRetry(
      () => supabaseAdmin.rpc("create_order_with_items", {
        p_customer_id: customerId,
        p_fulfillment_type: requestBody.fulfillment.type,
        p_delivery_address: requestBody.fulfillment.address?.trim() || null,
        p_pickup_point_id: requestBody.fulfillment.pickup_point_id || null,
        p_delivery_zone_id: requestBody.fulfillment.delivery_zone_id || null,
        p_guest_session_id: null,
        p_items: orderItems
      })
    );

    if (orderError) {
      console.error("❌ Order creation failed:", orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    if (!orderId) {
      throw new Error("Order creation returned no ID");
    }

    console.log("✅ Order created successfully:", orderId);

    // Fetch the created order with timeout
    const { data: order, error: fetchError } = await withRetry(
      () => supabaseAdmin
        .from("orders")
        .select("id, order_number, total_amount, customer_email")
        .eq("id", orderId)
        .single()
    );

    if (fetchError || !order) {
      console.error("❌ Failed to fetch created order:", fetchError);
      throw new Error("Order not found after creation");
    }

    // Validate order total matches calculation
    if (Math.abs(order.total_amount - calculatedTotal) > 0.01) {
      console.error("❌ Order total mismatch:", { 
        calculated: calculatedTotal,
        stored: order.total_amount 
      });
      throw new Error("Order total validation failed");
    }

    console.log("💰 Order details:", order);

    // Build payment callback URL with proper encoding
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payment-callback?order_id=${encodeURIComponent(order.id)}`;
    console.log("🔗 Payment callback URL:", callbackUrl);

    // Initialize payment with enhanced error handling
    console.log("💳 Initializing payment via paystack-secure...");
    
    const paymentMetadata = {
      order_id: order.id,
      customer_name: requestBody.customer.name?.trim() || "",
      order_number: order.order_number,
      fulfillment_type: requestBody.fulfillment.type,
      items_count: orderItems.length,
      client_total: order.total_amount,
      created_at: new Date().toISOString()
    };

    const { data: paymentData, error: paymentError } = await withRetry(
      () => supabaseAdmin.functions.invoke("paystack-secure", {
        body: {
          action: "initialize",
          email: order.customer_email,
          amount: Math.round(order.total_amount * 100), // Convert to kobo
          metadata: paymentMetadata,
          callback_url: callbackUrl
        }
      }),
      1 // Only retry once for payment initialization
    );

    if (paymentError) {
      console.error("❌ Payment initialization failed:", paymentError);
      throw new Error(`Payment initialization failed: ${paymentError.message}`);
    }

    if (!paymentData) {
      throw new Error("Payment service returned no data");
    }

    console.log("🔍 Payment initialization response received");

    // Extract payment info with proper fallback
    const paymentReference = paymentData?.data?.reference || paymentData?.reference;
    const authorizationUrl = paymentData?.data?.authorization_url || paymentData?.authorization_url;

    if (!paymentReference || !authorizationUrl) {
      console.error("❌ Invalid payment response:", paymentData);
      throw new Error("Invalid payment initialization response");
    }

    // Validate authorization URL
    try {
      new URL(authorizationUrl);
    } catch {
      throw new Error("Invalid payment authorization URL");
    }

    console.log("✅ Payment initialized successfully");
    console.log("💳 Payment reference:", paymentReference);

    // Success response with comprehensive data
    const response = {
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        status: "pending",
        items_count: orderItems.length
      },
      customer: {
        id: customerId,
        email: order.customer_email
      },
      payment: {
        authorization_url: authorizationUrl,
        reference: paymentReference
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    // Determine appropriate HTTP status code
    let status = 500;
    
    if (error?.message?.includes('required') || 
        error?.message?.includes('Invalid') ||
        error?.message?.includes('must be') ||
        error?.message?.includes('cannot exceed')) {
      status = 400; // Bad Request
    } else if (error?.message?.includes('not found')) {
      status = 404; // Not Found
    } else if (error?.message?.includes('too large')) {
      status = 413; // Payload Too Large
    }

    return createErrorResponse(error, status);
  }
});

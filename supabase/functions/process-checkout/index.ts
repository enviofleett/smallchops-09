import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// JSON Schema for validation
const checkoutSchema = {
  type: "object",
  required: ["customer_email", "customer_name", "order_items", "fulfillment_type", "payment_method"],
  properties: {
    customer_email: { type: "string", format: "email" },
    customer_name: { type: "string", minLength: 1 },
    customer_phone: { type: "string", pattern: "^[+]?[0-9\\s\\-\\(\\)]{10,20}$" },
    order_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["product_id", "quantity"],
        properties: {
          product_id: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
          quantity: { type: "number", minimum: 1 },
          price: { type: "number", minimum: 0 },
          unit_price: { type: "number", minimum: 0 },
          total_price: { type: "number", minimum: 0 },
          discount_amount: { type: "number", minimum: 0 }
        }
      }
    },
    fulfillment_type: { type: "string", enum: ["delivery", "pickup"] },
    delivery_address: {
      type: "object",
      properties: {
        address_line_1: { type: "string", minLength: 1 },
        address_line_2: { type: "string" },
        city: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 1 },
        postal_code: { type: "string", minLength: 1 },
        country: { type: "string", minLength: 1 },
        phone: { type: "string" },
        delivery_instructions: { type: "string" }
      },
      required: ["address_line_1", "city", "state", "postal_code", "country"]
    },
    pickup_point_id: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    delivery_zone_id: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$" },
    guest_session_id: { type: "string" },
    payment_method: { type: "string", enum: ["bank_transfer", "cash_on_delivery", "paystack"] },
    total_amount: { type: "number", minimum: 0 },
    delivery_fee: { type: "number", minimum: 0 }
  }
}

// Simple JSON Schema validator
function validateSchema(data: any, schema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (!data.hasOwnProperty(field) || data[field] === null || data[field] === undefined) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }
  
  // Check field types and formats
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties as any)) {
      if (data[key] !== undefined && data[key] !== null) {
        if (prop.type === "string" && typeof data[key] !== "string") {
          errors.push(`Field ${key} must be a string`);
        } else if (prop.type === "number" && typeof data[key] !== "number") {
          errors.push(`Field ${key} must be a number`);
        } else if (prop.type === "array" && !Array.isArray(data[key])) {
          errors.push(`Field ${key} must be an array`);
        } else if (prop.format === "email" && typeof data[key] === "string" && !data[key].includes("@")) {
          errors.push(`Field ${key} must be a valid email`);
        } else if (prop.pattern && typeof data[key] === "string" && !new RegExp(prop.pattern).test(data[key])) {
          errors.push(`Field ${key} has invalid format`);
        } else if (prop.minimum !== undefined && typeof data[key] === "number" && data[key] < prop.minimum) {
          errors.push(`Field ${key} must be at least ${prop.minimum}`);
        } else if (prop.minLength !== undefined && typeof data[key] === "string" && data[key].length < prop.minLength) {
          errors.push(`Field ${key} must be at least ${prop.minLength} characters`);
        } else if (prop.enum && !prop.enum.includes(data[key])) {
          errors.push(`Field ${key} must be one of: ${prop.enum.join(", ")}`);
        }
        
        // Validate array items
        if (prop.type === "array" && prop.items && Array.isArray(data[key])) {
          for (let i = 0; i < data[key].length; i++) {
            const itemValidation = validateSchema(data[key][i], prop.items);
            if (!itemValidation.valid) {
              errors.push(...itemValidation.errors.map(err => `Item ${i + 1}: ${err}`));
            }
          }
        }
        
        // Validate nested objects
        if (prop.type === "object" && typeof data[key] === "object") {
          const nestedValidation = validateSchema(data[key], prop);
          if (!nestedValidation.valid) {
            errors.push(...nestedValidation.errors.map(err => `${key}.${err}`));
          }
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Database error categorization
enum DatabaseErrorType {
  FOREIGN_KEY_VIOLATION = "foreign_key_violation",
  UNIQUE_VIOLATION = "unique_violation",
  NOT_NULL_VIOLATION = "not_null_violation",
  CHECK_VIOLATION = "check_violation",
  CONNECTION_ERROR = "connection_error",
  TIMEOUT_ERROR = "timeout_error",
  UNKNOWN = "unknown"
}

function categorizeDbError(error: any): { type: DatabaseErrorType; userMessage: string; shouldRetry: boolean } {
  const errorMessage = error.message?.toLowerCase() || "";
  const errorCode = error.code;
  
  if (errorCode === "23503" || errorMessage.includes("foreign key")) {
    return {
      type: DatabaseErrorType.FOREIGN_KEY_VIOLATION,
      userMessage: "Invalid reference to product, delivery zone, or pickup point",
      shouldRetry: false
    };
  }
  
  if (errorCode === "23505" || errorMessage.includes("unique")) {
    return {
      type: DatabaseErrorType.UNIQUE_VIOLATION,
      userMessage: "Duplicate order detected",
      shouldRetry: true
    };
  }
  
  if (errorCode === "23502" || errorMessage.includes("not null")) {
    return {
      type: DatabaseErrorType.NOT_NULL_VIOLATION,
      userMessage: "Missing required information",
      shouldRetry: false
    };
  }
  
  if (errorCode === "23514" || errorMessage.includes("check constraint")) {
    return {
      type: DatabaseErrorType.CHECK_VIOLATION,
      userMessage: "Invalid data format or values",
      shouldRetry: false
    };
  }
  
  if (errorMessage.includes("connection") || errorMessage.includes("timeout")) {
    return {
      type: DatabaseErrorType.CONNECTION_ERROR,
      userMessage: "Database connection issue",
      shouldRetry: true
    };
  }
  
  return {
    type: DatabaseErrorType.UNKNOWN,
    userMessage: "An unexpected error occurred",
    shouldRetry: false
  };
}

// Fallback values and strategies
const FALLBACK_CONFIG = {
  DEFAULT_DELIVERY_FEE: 0,
  DEFAULT_PAYMENT_METHOD: "cash_on_delivery",
  DEFAULT_COUNTRY: "Nigeria",
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const current = rateLimitMap.get(identifier);
  
  if (!current || now - current.lastReset > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return true;
  }
  
  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  current.count++;
  return true;
}

interface CheckoutRequest {
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  order_items: Array<{
    product_id: string;
    quantity: number;
    price?: number;
    unit_price?: number;
    total_price?: number;
    discount_amount?: number;
  }>;
  total_amount?: number;
  delivery_fee?: number;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone?: string;
    delivery_instructions?: string;
  };
  pickup_point_id?: string;
  guest_session_id?: string;
  payment_method: 'bank_transfer' | 'cash_on_delivery' | 'paystack';
}

interface OrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
}

// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to clean and validate UUID
function cleanUUID(value: any): string | null {
  if (!value || value === 'null' || value === 'undefined') return null;
  
  if (typeof value !== 'string') return null;
  
  const cleaned = value.trim().replace(/^guest_/, '');
  return isValidUUID(cleaned) ? cleaned : null;
}

// Helper function to find or create customer account
async function findOrCreateCustomer(
  supabase: any,
  email: string,
  name: string,
  phone?: string
): Promise<{ customer_id: string; isNew: boolean }> {
  console.log(`🔍 Looking for existing customer: ${email}`);
  
  // First, try to find existing customer account
  const { data: existingCustomer, error: findError } = await supabase
    .from('customer_accounts')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (findError) {
    console.error('❌ Error finding customer:', findError);
    throw new Error(`Failed to find customer: ${findError.message}`);
  }

  if (existingCustomer) {
    console.log(`✅ Found existing customer: ${existingCustomer.id}`);
    return { customer_id: existingCustomer.id, isNew: false };
  }

  console.log(`👤 Creating new customer account for: ${email}`);
  
  // Create new customer account
  const { data: newCustomer, error: createError } = await supabase
    .from('customer_accounts')
    .insert({
      name,
      email,
      phone: phone || null,
      user_id: crypto.randomUUID(), // Generate temporary user_id for guest
      email_verified: false,
      phone_verified: false,
      profile_completion_percentage: 30
    })
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Error creating customer:', createError);
    throw new Error(`Failed to create customer: ${createError.message}`);
  }

  console.log(`✅ Created new customer: ${newCustomer.id}`);
  return { customer_id: newCustomer.id, isNew: true };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    // Rate limiting check
    const clientIP = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      console.error(`🚫 Rate limit exceeded for IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: corsHeaders }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const rawData = await req.json();
    console.log(`📦 [${requestId}] Processing checkout request:`, {
      customer_email: rawData.customer_email,
      customer_name: rawData.customer_name,
      fulfillment_type: rawData.fulfillment_type,
      items_count: rawData.order_items?.length || 0,
      payment_method: rawData.payment_method
    });

    // JSON Schema validation
    const validation = validateSchema(rawData, checkoutSchema);
    if (!validation.valid) {
      console.error(`❌ [${requestId}] Schema validation failed:`, validation.errors);
      return new Response(
        JSON.stringify({ error: `Validation failed: ${validation.errors.join(", ")}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    const checkoutData: CheckoutRequest = rawData;

    // Apply fallbacks for missing optional data
    if (!checkoutData.delivery_fee) {
      checkoutData.delivery_fee = FALLBACK_CONFIG.DEFAULT_DELIVERY_FEE;
    }
    
    if (checkoutData.delivery_address && !checkoutData.delivery_address.country) {
      checkoutData.delivery_address.country = FALLBACK_CONFIG.DEFAULT_COUNTRY;
    }

    // Find or create customer account
    const { customer_id, isNew: isNewCustomer } = await findOrCreateCustomer(
      supabaseClient,
      checkoutData.customer_email,
      checkoutData.customer_name,
      checkoutData.customer_phone
    );

    // Transform order items with enhanced fallback pricing
    const transformedItems: OrderItem[] = await Promise.all(
      checkoutData.order_items.map(async (item, index) => {
        let unitPrice = item.unit_price || item.price || 0;
        
        // Fallback: fetch price from database if not provided
        if (unitPrice <= 0) {
          console.warn(`⚠️ [${requestId}] Missing price for item ${index + 1}, fetching from database`);
          try {
            const { data: product } = await supabaseClient
              .from('products')
              .select('price')
              .eq('id', item.product_id)
              .single();
            
            if (product) {
              unitPrice = product.price;
              console.log(`✅ [${requestId}] Fetched price for item ${index + 1}: ${unitPrice}`);
            }
          } catch (error) {
            console.error(`❌ [${requestId}] Failed to fetch price for item ${index + 1}:`, error);
          }
        }
        
        return {
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          discount_amount: item.discount_amount || 0
        };
      })
    );

    // Clean and validate UUIDs
    const cleanGuestSessionId = cleanUUID(checkoutData.guest_session_id);
    const cleanDeliveryZoneId = cleanUUID(checkoutData.delivery_zone_id);
    const cleanPickupPointId = cleanUUID(checkoutData.pickup_point_id);

    console.log(`🔧 [${requestId}] Transformed parameters:`, {
      customer_id,
      fulfillment_type: checkoutData.fulfillment_type,
      delivery_zone_id: cleanDeliveryZoneId,
      pickup_point_id: cleanPickupPointId,
      guest_session_id: cleanGuestSessionId,
      items_count: transformedItems.length
    });

    // Enhanced validation with fallbacks
    if (checkoutData.fulfillment_type === 'pickup') {
      if (!cleanPickupPointId) {
        // Fallback: try to find default pickup point
        console.warn(`⚠️ [${requestId}] No pickup point specified, looking for default`);
        const { data: defaultPickup } = await supabaseClient
          .from('pickup_points')
          .select('id')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        
        if (defaultPickup) {
          cleanPickupPointId = defaultPickup.id;
          console.log(`✅ [${requestId}] Using default pickup point: ${cleanPickupPointId}`);
        } else {
          console.error(`❌ [${requestId}] No pickup points available`);
          return new Response(
            JSON.stringify({ error: 'No pickup points available' }),
            { status: 400, headers: corsHeaders }
          );
        }
      }
    }

    if (checkoutData.fulfillment_type === 'delivery' && !checkoutData.delivery_address) {
      console.error(`❌ [${requestId}] Delivery address required for delivery orders`);
      return new Response(
        JSON.stringify({ error: 'delivery_address is required for delivery orders' }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`🚀 [${requestId}] Calling create_order_with_items function...`);

    // Call the database function with retry logic for transient errors
    let orderId: string | null = null;
    let orderError: any = null;
    
    for (let attempt = 1; attempt <= FALLBACK_CONFIG.RETRY_ATTEMPTS; attempt++) {
      const { data, error } = await supabaseClient
        .rpc('create_order_with_items', {
          p_customer_id: customer_id,
          p_fulfillment_type: checkoutData.fulfillment_type,
          p_delivery_address: checkoutData.delivery_address || null,
          p_pickup_point_id: cleanPickupPointId,
          p_delivery_zone_id: cleanDeliveryZoneId,
          p_guest_session_id: cleanGuestSessionId,
          p_items: transformedItems
        });

      if (!error) {
        orderId = data;
        break;
      }

      orderError = error;
      const errorInfo = categorizeDbError(error);
      console.error(`❌ [${requestId}] Attempt ${attempt} failed:`, error.message);

      if (!errorInfo.shouldRetry || attempt === FALLBACK_CONFIG.RETRY_ATTEMPTS) {
        console.error(`❌ [${requestId}] Database error (${errorInfo.type}):`, errorInfo.userMessage);
        return new Response(
          JSON.stringify({ error: errorInfo.userMessage }),
          { status: errorInfo.type === DatabaseErrorType.FOREIGN_KEY_VIOLATION ? 400 : 500, headers: corsHeaders }
        );
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, FALLBACK_CONFIG.RETRY_DELAY_MS * attempt));
    }

    if (!orderId) {
      console.error(`❌ [${requestId}] No order ID returned from database function`);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ [${requestId}] Order created successfully: ${orderId}`);

    // Get the created order details for response
    const { data: orderDetails, error: fetchError } = await supabaseClient
      .from('orders')
      .select('order_number, total_amount')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.warn('⚠️ Could not fetch order details:', fetchError);
    }

    // Handle payment processing
    if (checkoutData.payment_method === 'paystack') {
      console.log('💳 Processing Paystack payment...');
      
      // Generate unique reference for payment transaction
      const paymentReference = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert payment transaction record
      const { data: paymentTransaction, error: paymentError } = await supabaseClient
        .from('payment_transactions')
        .insert({
          order_id: orderId,
          customer_email: checkoutData.customer_email,
          customer_name: checkoutData.customer_name,
          amount: orderDetails?.total_amount || checkoutData.total_amount || 0,
          currency: 'NGN',
          payment_method: 'paystack',
          status: 'pending',
          provider_reference: paymentReference,
          transaction_type: 'charge'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('❌ Error creating payment transaction:', paymentError);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment transaction' }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('💾 Payment transaction created:', paymentTransaction.id);

      // Use paystack-secure function to initialize payment
      const paymentAmount = orderDetails?.total_amount || checkoutData.total_amount || 0;
      
      if (!paymentAmount || paymentAmount <= 0) {
        console.error('❌ Invalid payment amount:', paymentAmount);
        return new Response(
          JSON.stringify({ error: 'Invalid payment amount' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: paystackData, error: paystackError } = await supabaseClient.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: checkoutData.customer_email,
          amount: Math.round(paymentAmount * 100), // Convert to kobo
          reference: paymentReference,
          channels: ['card', 'bank', 'ussd', 'mobile_money'],
          metadata: {
            order_id: orderId,
            order_number: orderDetails?.order_number,
            customer_name: checkoutData.customer_name,
            customer_email: checkoutData.customer_email,
            total_amount: paymentAmount
          }
        }
      });

      if (paystackError || !paystackData?.status) {
        console.error('❌ Paystack initialization failed:', paystackError || paystackData);
        return new Response(
          JSON.stringify({ 
            error: 'Payment initialization failed',
            details: paystackError?.message || paystackData?.error || 'Unknown payment gateway error'
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log(`✅ [${requestId}] Paystack payment initialized`);

      // Performance logging
      const processingTime = Date.now() - startTime;
      console.log(`⏱️ [${requestId}] Total processing time: ${processingTime}ms`);

      return new Response(
        JSON.stringify({
          order_id: orderId,
          payment_url: paystackData.data.authorization_url
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // For other payment methods, trigger order confirmation email
      await supabaseClient.functions.invoke('enhanced-email-processor', {
        body: {
          event_type: 'order_confirmation',
          recipient_email: checkoutData.customer_email,
          order_id: orderId,
          priority: 'high'
        }
      });
    }

    // Log checkout completion
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'checkout_completed_v2',
        category: 'Order Management',
        message: `Checkout completed for order ${orderId}`,
        new_values: {
          order_id: orderId,
          order_number: orderDetails?.order_number,
          customer_id,
          customer_email: checkoutData.customer_email,
          payment_method: checkoutData.payment_method,
          total_amount: orderDetails?.total_amount,
          is_new_customer: isNewCustomer,
          fulfillment_type: checkoutData.fulfillment_type
        }
      });

    // Trigger enhanced email processor for order created event
    await supabaseClient.functions.invoke('enhanced-email-processor', {
      body: {
        event_type: 'order_created',
        recipient_email: checkoutData.customer_email,
        order_id: orderId
      }
    });

    // Performance logging
    const processingTime = Date.now() - startTime;
    console.log(`⏱️ [${requestId}] Total processing time: ${processingTime}ms`);

    return new Response(
      JSON.stringify({ order_id: orderId }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`💥 [${requestId}] Checkout processing error (${processingTime}ms):`, error);
    
    // Log critical errors for monitoring
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      console.error(`🚨 [${requestId}] Critical infrastructure error:`, {
        error: error.message,
        stack: error.stack,
        processingTime
      });
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error occurred' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
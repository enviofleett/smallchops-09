import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Rate limiting configuration
const RATE_LIMITS = {
  checkout_attempts: { max: 5, window: 300 }, // 5 attempts per 5 minutes
  ip_requests: { max: 20, window: 300 }, // 20 requests per 5 minutes per IP
};

// Security validation helper
function validateSecurityHeaders(req: Request): { valid: boolean; error?: string } {
  const userAgent = req.headers.get("user-agent");
  const origin = req.headers.get("origin");
  
  // Block suspicious user agents
  if (!userAgent || userAgent.length < 10) {
    return { valid: false, error: "Invalid user agent" };
  }
  
  // Basic bot detection
  const botPatterns = /bot|crawler|spider|scraper/i;
  if (botPatterns.test(userAgent)) {
    return { valid: false, error: "Automated requests not allowed" };
  }
  
  return { valid: true };
}

// Enhanced rate limiting function
async function checkRateLimit(
  identifier: string, 
  type: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const config = RATE_LIMITS[type];
  const windowStart = Math.floor(Date.now() / 1000) - config.window;
  
  try {
    // Clean up old entries
    await supabaseAdmin
      .from("api_rate_limits")
      .delete()
      .lt("window_start", new Date(windowStart * 1000).toISOString());
    
    // Check current rate
    const { data: existing } = await supabaseAdmin
      .from("api_rate_limits")
      .select("request_count")
      .eq("identifier", identifier)
      .eq("endpoint", type)
      .gte("window_start", new Date(windowStart * 1000).toISOString())
      .single();
    
    if (existing && existing.request_count >= config.max) {
      return { 
        allowed: false, 
        retryAfter: config.window 
      };
    }
    
    // Increment counter
    await supabaseAdmin
      .from("api_rate_limits")
      .upsert({
        identifier,
        endpoint: type,
        request_count: (existing?.request_count || 0) + 1,
        window_start: new Date().toISOString()
      }, {
        onConflict: "identifier,endpoint"
      });
    
    return { allowed: true };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return { allowed: true }; // Fail open for availability
  }
}

// Enhanced input sanitization
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/<[^>]*>/g, '') // Strip HTML
      .replace(/[<>'"&]/g, '') // Remove dangerous chars
      .trim()
      .slice(0, 1000); // Limit length
  }
  
  if (Array.isArray(input)) {
    return input.slice(0, 100).map(sanitizeInput); // Limit array size
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    Object.keys(input).slice(0, 50).forEach(key => { // Limit object keys
      sanitized[sanitizeInput(key)] = sanitizeInput(input[key]);
    });
    return sanitized;
  }
  
  return input;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestBody = null;
  let sessionId = crypto.randomUUID();

  try {
    // Security validation
    const securityCheck = validateSecurityHeaders(req);
    if (!securityCheck.valid) {
      console.warn(`🚨 Security violation: ${securityCheck.error}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Request blocked for security reasons",
          code: "SECURITY_VIOLATION"
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || 
                    req.headers.get("x-real-ip") || 
                    "unknown";
    
    const ipRateLimit = await checkRateLimit(clientIP, "ip_requests");
    if (!ipRateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: ipRateLimit.retryAfter
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "Retry-After": ipRateLimit.retryAfter?.toString() || "300"
          } 
        }
      );
    }

    // Parse and sanitize request
    try {
      const rawBody = await req.json();
      requestBody = sanitizeInput(rawBody);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request format",
          code: "INVALID_JSON"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enhanced validation with security considerations
    const validationErrors = [];
    
    // Email validation with additional security checks
    if (!requestBody.customer?.email) {
      validationErrors.push("Customer email is required");
    } else {
      const email = requestBody.customer.email.toLowerCase().trim();
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      if (!emailRegex.test(email)) {
        validationErrors.push("Valid email format required");
      }
      
      // Check for suspicious email patterns
      if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
        validationErrors.push("Invalid email format");
      }
      
      // Rate limit by email
      const emailRateLimit = await checkRateLimit(email, "checkout_attempts");
      if (!emailRateLimit.allowed) {
        validationErrors.push("Too many checkout attempts. Please wait before trying again.");
      }
    }

    // Enhanced item validation
    if (!requestBody.items || !Array.isArray(requestBody.items) || requestBody.items.length === 0) {
      validationErrors.push("Order must contain at least one item");
    } else if (requestBody.items.length > 50) {
      validationErrors.push("Too many items in order (maximum 50)");
    } else {
      requestBody.items.forEach((item: any, index: number) => {
        if (!item.product_id || typeof item.product_id !== 'string') {
          validationErrors.push(`Item ${index + 1}: Invalid product ID`);
        }
        
        const quantity = parseInt(item.quantity);
        if (isNaN(quantity) || quantity <= 0 || quantity > 99) {
          validationErrors.push(`Item ${index + 1}: Invalid quantity (1-99)`);
        }
        
        const price = parseFloat(item.unit_price);
        if (isNaN(price) || price <= 0 || price > 1000000) {
          validationErrors.push(`Item ${index + 1}: Invalid price`);
        }
      });
    }

    if (validationErrors.length > 0) {
      console.warn("❌ Validation errors:", validationErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          details: validationErrors,
          code: "VALIDATION_FAILED"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log request for monitoring
    await supabaseAdmin
      .from("api_request_logs")
      .insert({
        endpoint: "production-checkout-security",
        method: req.method,
        ip_address: clientIP,
        user_agent: req.headers.get("user-agent"),
        request_payload: {
          customer_email: requestBody.customer?.email,
          items_count: requestBody.items?.length,
          fulfillment_type: requestBody.fulfillment?.type,
          session_id: sessionId
        },
        session_id: sessionId
      });

    // Forward to main process-checkout function with enhanced metadata
    const enhancedPayload = {
      ...requestBody,
      _security: {
        session_id: sessionId,
        validated_at: new Date().toISOString(),
        client_ip: clientIP,
        security_passed: true
      }
    };

    const { data: checkoutResult, error: checkoutError } = await supabaseAdmin.functions.invoke(
      "process-checkout",
      {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-caller": "production-checkout-security",
          "x-session-id": sessionId,
          "Content-Type": "application/json"
        },
        body: enhancedPayload,
      }
    );

    if (checkoutError) {
      throw new Error(`Checkout service error: ${checkoutError.message}`);
    }

    // Log successful completion
    const responseTime = Date.now() - startTime;
    await supabaseAdmin
      .from("api_request_logs")
      .update({
        response_status: 200,
        response_time_ms: responseTime
      })
      .eq("session_id", sessionId);

    return new Response(
      JSON.stringify({
        ...checkoutResult,
        _metadata: {
          processed_at: new Date().toISOString(),
          response_time_ms: responseTime,
          security_validated: true
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorId = `SEC_ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const responseTime = Date.now() - startTime;
    
    console.error(`❌ Production checkout security error [${errorId}]:`, {
      message: error.message,
      stack: error.stack,
      session_id: sessionId,
      response_time_ms: responseTime
    });

    // Log error
    await supabaseAdmin
      .from("api_request_logs")
      .update({
        response_status: 500,
        response_time_ms: responseTime,
        error_details: {
          error_id: errorId,
          message: error.message,
          type: error.constructor.name
        }
      })
      .eq("session_id", sessionId);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Checkout processing failed. Please try again.",
        error_id: errorId,
        code: "INTERNAL_ERROR",
        details: {
          can_retry: true,
          contact_support: true,
          session_id: sessionId
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
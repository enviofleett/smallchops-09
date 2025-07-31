import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Enhanced logging middleware
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const startTime = Date.now();

    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname} from ${clientIP}`);

    // Rate limiting check with tier-based limits
    const checkRateLimit = async (endpoint: string, ip: string, customerId?: string) => {
      const tier = customerId ? await getCustomerTier(customerId) : 'standard';
      
      const { data: rateLimitOk } = await supabase.rpc('check_customer_rate_limit', {
        p_customer_id: customerId || null,
        p_ip_address: ip,
        p_endpoint: endpoint,
        p_tier: tier
      });

      if (!rateLimitOk) {
        // Log security incident
        await supabase.rpc('log_security_incident', {
          p_incident_type: 'rate_limit_exceeded',
          p_severity: 'medium',
          p_ip_address: ip,
          p_user_agent: userAgent,
          p_endpoint: endpoint,
          p_details: { tier, timestamp: new Date().toISOString() }
        });

        throw new Error('Rate limit exceeded');
      }
    };

    const getCustomerTier = async (customerId: string): Promise<string> => {
      // Check customer purchase history to determine tier
      const { data: analytics } = await supabase
        .from('customer_purchase_analytics')
        .select('total_spent')
        .eq('customer_id', customerId)
        .single();

      if (analytics?.total_spent > 10000) return 'premium';
      if (analytics?.total_spent > 5000) return 'business';
      return 'standard';
    };

    // Log API request
    const logRequest = async (endpoint: string, status: number, responseTime: number, error?: any) => {
      await supabase.rpc('log_api_request', {
        p_endpoint: endpoint,
        p_method: req.method,
        p_ip_address: clientIP,
        p_user_agent: userAgent,
        p_response_status: status,
        p_response_time_ms: responseTime,
        p_error_details: error ? { message: error.message, stack: error.stack } : null
      });
    };

    // Enhanced error handling
    const handleError = async (error: Error, endpoint: string) => {
      const responseTime = Date.now() - startTime;
      console.error(`Error in ${endpoint}:`, error);

      // Log security incident for suspicious patterns
      if (error.message.includes('injection') || error.message.includes('script')) {
        await supabase.rpc('log_security_incident', {
          p_incident_type: 'potential_injection',
          p_severity: 'high',
          p_ip_address: clientIP,
          p_user_agent: userAgent,
          p_endpoint: endpoint,
          p_details: { error: error.message }
        });
      }

      await logRequest(endpoint, 500, responseTime, error);

      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          timestamp: new Date().toISOString()
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    };

    switch (path) {
      case 'health': {
        const responseTime = Date.now() - startTime;
        await logRequest('/health', 200, responseTime);
        
        return new Response(
          JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            responseTime: responseTime
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'metrics': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        await checkRateLimit('/metrics', clientIP);

        // Get API metrics for dashboard
        const { data: metrics, error } = await supabase
          .from('api_metrics')
          .select('*')
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });

        if (error) throw error;

        const responseTime = Date.now() - startTime;
        await logRequest('/metrics', 200, responseTime);

        return new Response(JSON.stringify(metrics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'incidents': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        await checkRateLimit('/incidents', clientIP);

        // Get recent security incidents
        const { data: incidents, error } = await supabase
          .from('security_incidents')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const responseTime = Date.now() - startTime;
        await logRequest('/incidents', 200, responseTime);

        return new Response(JSON.stringify(incidents), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'validate': {
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const body = await req.json();
        await checkRateLimit('/validate', clientIP);

        // Enhanced input validation
        const validateInput = (data: any, schema: any) => {
          const errors: string[] = [];
          
          for (const [key, rules] of Object.entries(schema)) {
            const value = data[key];
            const ruleSet = rules as any;
            
            if (ruleSet.required && (value === undefined || value === null || value === '')) {
              errors.push(`${key} is required`);
              continue;
            }
            
            if (value !== undefined && value !== null && value !== '') {
              if (ruleSet.type && typeof value !== ruleSet.type) {
                errors.push(`${key} must be of type ${ruleSet.type}`);
              }
              
              if (ruleSet.minLength && value.length < ruleSet.minLength) {
                errors.push(`${key} must be at least ${ruleSet.minLength} characters`);
              }
              
              if (ruleSet.maxLength && value.length > ruleSet.maxLength) {
                errors.push(`${key} must be at most ${ruleSet.maxLength} characters`);
              }
              
              if (ruleSet.pattern && !new RegExp(ruleSet.pattern).test(value)) {
                errors.push(`${key} format is invalid`);
              }
            }
          }
          
          return errors;
        };

        // Example validation schema
        const schema = {
          email: { required: true, type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' },
          name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
          phone: { type: 'string', pattern: '^\\+?[1-9]\\d{1,14}$' }
        };

        const validationErrors = validateInput(body, schema);
        
        if (validationErrors.length > 0) {
          const responseTime = Date.now() - startTime;
          await logRequest('/validate', 400, responseTime, { validationErrors });
          
          return new Response(
            JSON.stringify({
              error: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: validationErrors
            }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }

        const responseTime = Date.now() - startTime;
        await logRequest('/validate', 200, responseTime);

        return new Response(
          JSON.stringify({ valid: true, message: 'Input validation passed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default: {
        const responseTime = Date.now() - startTime;
        await logRequest(url.pathname, 404, responseTime);
        
        return new Response(
          JSON.stringify({
            error: 'Endpoint not found',
            code: 'NOT_FOUND',
            message: 'The requested endpoint does not exist'
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }
  } catch (error) {
    console.error('Security monitor error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
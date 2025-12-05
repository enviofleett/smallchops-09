import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RateLimitCheck {
  user_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (req.method === 'POST') {
      const body: RateLimitCheck = await req.json();
      const { user_id } = body;

      // Check upload rate limit: 10 uploads per hour per user
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data: recentUploads, error } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('action', 'product_image_upload')
        .eq('user_id', user_id)
        .gte('created_at', oneHourAgo);

      if (error) {
        console.error('Rate limit check error:', error);
        return new Response(
          JSON.stringify({ allowed: false, error: 'Rate limit check failed' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const uploadCount = recentUploads?.length || 0;
      const RATE_LIMIT = 100; // Increased from 10 to 100 for production
      const allowed = uploadCount < RATE_LIMIT;

      return new Response(
        JSON.stringify({
          allowed,
          current_count: uploadCount,
          limit: RATE_LIMIT,
          remaining: Math.max(0, RATE_LIMIT - uploadCount),
          reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Rate limit check error:', error);
    return new Response(
      JSON.stringify({ allowed: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
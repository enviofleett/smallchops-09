import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RateLimitCheck {
  user_id: string;
  user_role?: string;
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
      const { user_id, user_role } = body;

      // Get user role if not provided
      let userRole = user_role;
      if (!userRole) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user_id)
          .single();
        userRole = profile?.role;
      }

      // Smart rate limiting based on user role
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: recentUploads, error } = await supabase
        .from('audit_logs')
        .select('id, created_at')
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
      const burstCount = recentUploads?.filter(upload => upload.created_at >= fiveMinutesAgo).length || 0;
      
      // Rate limits based on role
      const hourlyLimit = userRole === 'admin' ? 100 : 20;
      const burstLimit = 10;
      
      const hourlyAllowed = uploadCount < hourlyLimit;
      const burstAllowed = burstCount < burstLimit;
      const allowed = hourlyAllowed && burstAllowed;

      return new Response(
        JSON.stringify({
          allowed,
          current_count: uploadCount,
          limit: hourlyLimit,
          burst_count: burstCount,
          burst_limit: burstLimit,
          reset_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          burst_reset_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          user_role: userRole,
          reason: !allowed ? (!burstAllowed ? 'burst_limit_exceeded' : 'hourly_limit_exceeded') : 'allowed'
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
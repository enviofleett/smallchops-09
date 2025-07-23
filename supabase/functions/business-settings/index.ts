import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/ // Dev/Preview domains
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://oknnklksdiqaifhxaccs.lovableproject.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: user } = await supabaseClient.auth.getUser(token)

    if (!user.user) {
      throw new Error('Unauthorized')
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.user.id)
      .single()

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required')
    }

    if (req.method === 'GET') {
      const { data: settings, error } = await supabaseClient
        .from('business_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return new Response(
        JSON.stringify({ data: settings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json()
      
      // Validate required fields
      if (!body.name || body.name.trim().length === 0) {
        throw new Error('Business name is required')
      }

      // Validate email format if provided
      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        throw new Error('Invalid email format')
      }

      // Validate URLs if provided
      const urlFields = ['website_url', 'facebook_url', 'instagram_url', 'tiktok_url', 'twitter_url', 'linkedin_url', 'youtube_url']
      for (const field of urlFields) {
        if (body[field] && body[field].trim() !== '') {
          try {
            new URL(body[field])
          } catch {
            throw new Error(`Invalid URL format for ${field}`)
          }
        }
      }

      // Check if settings exist
      const { data: existing } = await supabaseClient
        .from('business_settings')
        .select('id')
        .single()

      let result
      if (existing) {
        // Update existing settings
        const { data, error } = await supabaseClient
          .from('business_settings')
          .update(body)
          .eq('id', existing.id)
          .select()
          .single()
        
        if (error) throw error
        result = data
      } else {
        // Insert new settings
        const { data, error } = await supabaseClient
          .from('business_settings')
          .insert(body)
          .select()
          .single()
        
        if (error) throw error
        result = data
      }

      return new Response(
        JSON.stringify({ data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Business settings error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
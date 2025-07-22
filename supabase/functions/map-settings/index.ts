
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const adminCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: adminCorsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('User not authenticated')
    
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Access denied: Admins only.' }), {
        status: 403,
        headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('map_settings')
        .select('*')
        .eq('id', 1)
        .single()
      
      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await supabaseClient
        .from('map_settings')
        .update({
          monthly_usage_limit: body.monthly_usage_limit,
          usage_alert_email: body.usage_alert_email,
          usage_alert_threshold: body.usage_alert_threshold,
        })
        .eq('id', 1)
        .select()
        .single()
        
      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...adminCorsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

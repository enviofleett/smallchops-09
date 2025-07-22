
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
      const now = new Date();
      const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const firstDayOfMonthISO = firstDayOfMonth.toISOString();
      
      const { data: usage, error: usageError } = await supabaseClient
        .from('map_api_usage')
        .select('log_time, count')
        .gte('log_time', firstDayOfMonthISO);

      if (usageError) throw usageError;

      const { data: settings, error: settingsError } = await supabaseClient
        .from('map_settings')
        .select('monthly_usage_limit')
        .eq('id', 1)
        .single();
      
      if (settingsError) throw settingsError;
      
      const totalUsage = usage.reduce((acc, row) => acc + row.count, 0);

      const dailyUsage = usage.reduce((acc, row) => {
          const day = new Date(row.log_time).toISOString().split('T')[0];
          if (!acc[day]) {
              acc[day] = 0;
          }
          acc[day] += row.count;
          return acc;
      }, {} as Record<string, number>);

      const dailyUsageArray = Object.entries(dailyUsage).map(([date, count]) => ({ date, count }));

      return new Response(JSON.stringify({
          totalUsage,
          monthlyLimit: settings.monthly_usage_limit,
          dailyUsage: dailyUsageArray
      }), {
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

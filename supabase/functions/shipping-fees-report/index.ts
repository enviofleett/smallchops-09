import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShippingFeesRequest {
  period: 'weekly' | 'monthly'
  startDate?: string
  endDate?: string
}

interface ReportBucket {
  start_date: string
  end_date: string
  total_shipping_fees: number
  order_count: number
  period_label: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      console.error('Admin check failed:', profileError)
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: corsHeaders }
      )
    }

    const { period, startDate, endDate }: ShippingFeesRequest = await req.json()

    if (!period || !['weekly', 'monthly'].includes(period)) {
      return new Response(
        JSON.stringify({ error: 'Invalid period. Must be "weekly" or "monthly"' }),
        { status: 400, headers: corsHeaders }
      )
    }

    console.log(`Generating ${period} shipping fees report from ${startDate} to ${endDate}`)

    // Calculate date range if not provided
    const now = new Date()
    const defaultEndDate = endDate || now.toISOString().split('T')[0]
    let defaultStartDate = startDate

    if (!defaultStartDate) {
      const start = new Date(now)
      if (period === 'weekly') {
        start.setDate(start.getDate() - 28) // 4 weeks
      } else {
        start.setMonth(start.getMonth() - 6) // 6 months
      }
      defaultStartDate = start.toISOString().split('T')[0]
    }

    // Build aggregation query
    const dateFormat = period === 'weekly' 
      ? "DATE_TRUNC('week', order_time)::date"
      : "DATE_TRUNC('month', order_time)::date"

    const { data: reportData, error: queryError } = await supabase.rpc('execute', {
      query: `
        SELECT 
          ${dateFormat} as period_start,
          ${period === 'weekly' 
            ? "DATE_TRUNC('week', order_time)::date + INTERVAL '6 days'" 
            : "DATE_TRUNC('month', order_time)::date + INTERVAL '1 month - 1 day'"
          } as period_end,
          COALESCE(SUM(delivery_fee), 0) as total_shipping_fees,
          COUNT(*) as order_count
        FROM orders 
        WHERE 
          order_type = 'delivery' 
          AND payment_status = 'paid'
          AND order_time >= $1::date 
          AND order_time <= $2::date
        GROUP BY ${dateFormat}
        ORDER BY period_start DESC
      `,
      params: [defaultStartDate, defaultEndDate]
    })

    if (queryError) {
      console.error('Query error:', queryError)
      
      // Fallback to direct table query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('orders')
        .select('delivery_fee, order_time')
        .eq('order_type', 'delivery')
        .eq('payment_status', 'paid')
        .gte('order_time', defaultStartDate)
        .lte('order_time', defaultEndDate)

      if (fallbackError) {
        console.error('Fallback query error:', fallbackError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch shipping fees data' }),
          { status: 500, headers: corsHeaders }
        )
      }

      // Process fallback data manually
      const groupedData: { [key: string]: { total: number, count: number } } = {}
      
      fallbackData?.forEach(order => {
        const date = new Date(order.order_time)
        let periodKey: string
        
        if (period === 'weekly') {
          // Get start of week (Monday)
          const startOfWeek = new Date(date)
          startOfWeek.setDate(date.getDate() - date.getDay() + 1)
          periodKey = startOfWeek.toISOString().split('T')[0]
        } else {
          // Get start of month
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
        }

        if (!groupedData[periodKey]) {
          groupedData[periodKey] = { total: 0, count: 0 }
        }
        
        groupedData[periodKey].total += Number(order.delivery_fee || 0)
        groupedData[periodKey].count += 1
      })

      // Convert to report format
      const buckets: ReportBucket[] = Object.entries(groupedData).map(([startDate, data]) => {
        const start = new Date(startDate)
        const end = new Date(start)
        
        if (period === 'weekly') {
          end.setDate(start.getDate() + 6)
        } else {
          end.setMonth(start.getMonth() + 1)
          end.setDate(0) // Last day of month
        }

        return {
          start_date: startDate,
          end_date: end.toISOString().split('T')[0],
          total_shipping_fees: data.total,
          order_count: data.count,
          period_label: period === 'weekly' 
            ? `Week of ${start.toLocaleDateString()}`
            : `${start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        }
      }).sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

      return new Response(
        JSON.stringify({
          success: true,
          period,
          buckets,
          total_fees: buckets.reduce((sum, bucket) => sum + bucket.total_shipping_fees, 0),
          total_orders: buckets.reduce((sum, bucket) => sum + bucket.order_count, 0)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process successful query data
    const buckets: ReportBucket[] = (reportData || []).map((row: any) => ({
      start_date: row.period_start,
      end_date: row.period_end,
      total_shipping_fees: Number(row.total_shipping_fees || 0),
      order_count: Number(row.order_count || 0),
      period_label: period === 'weekly' 
        ? `Week of ${new Date(row.period_start).toLocaleDateString()}`
        : `${new Date(row.period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    }))

    const totalFees = buckets.reduce((sum, bucket) => sum + bucket.total_shipping_fees, 0)
    const totalOrders = buckets.reduce((sum, bucket) => sum + bucket.order_count, 0)

    console.log(`Report generated: ${buckets.length} buckets, ₦${totalFees} total fees, ${totalOrders} orders`)

    return new Response(
      JSON.stringify({
        success: true,
        period,
        buckets,
        total_fees: totalFees,
        total_orders: totalOrders,
        date_range: {
          start: defaultStartDate,
          end: defaultEndDate
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Shipping fees report error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})
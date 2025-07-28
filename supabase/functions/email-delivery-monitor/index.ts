import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MonitoringReport {
  totalSent: number
  totalDelivered: number
  totalBounced: number
  totalComplained: number
  totalSuppressed: number
  deliveryRate: number
  bounceRate: number
  complaintRate: number
  healthScore: number
  issues: string[]
  recommendations: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const timeframe = url.searchParams.get('timeframe') || '24h'
    const detailed = url.searchParams.get('detailed') === 'true'

    console.log(`Generating email delivery report for ${timeframe}`)

    const hours = getHoursFromTimeframe(timeframe)
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Get communication events
    const { data: events, error: eventsError } = await supabase
      .from('communication_events')
      .select('*')
      .gte('created_at', cutoffTime)
      .neq('event_type', 'rate_limit_check')

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`)
    }

    // Get delivery logs
    const { data: deliveryLogs, error: logsError } = await supabase
      .from('email_delivery_logs')
      .select('*')
      .gte('created_at', cutoffTime)

    if (logsError) {
      throw new Error(`Failed to fetch delivery logs: ${logsError.message}`)
    }

    // Get suppression list count
    const { count: suppressedCount, error: suppressedError } = await supabase
      .from('email_suppression_list')
      .select('*', { count: 'exact', head: true })

    if (suppressedError) {
      throw new Error(`Failed to fetch suppressed count: ${suppressedError.message}`)
    }

    const report = generateReport(events || [], deliveryLogs || [], suppressedCount || 0)

    if (detailed) {
      // Add detailed breakdowns
      const detailedReport = await generateDetailedReport(supabase, cutoffTime, report)
      
      return new Response(JSON.stringify({
        success: true,
        timeframe,
        report: detailedReport
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      timeframe,
      report
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Email delivery monitoring error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

function getHoursFromTimeframe(timeframe: string): number {
  switch (timeframe) {
    case '1h': return 1
    case '6h': return 6
    case '24h': return 24
    case '7d': return 24 * 7
    case '30d': return 24 * 30
    default: return 24
  }
}

function generateReport(events: any[], deliveryLogs: any[], suppressedCount: number): MonitoringReport {
  const totalSent = events.filter(e => e.status === 'sent').length
  
  // Count delivery statuses from logs
  const delivered = deliveryLogs.filter(log => log.event_type === 'delivered').length
  const bounced = deliveryLogs.filter(log => log.event_type === 'bounced').length
  const complained = deliveryLogs.filter(log => log.event_type === 'complained').length
  
  // Calculate rates
  const deliveryRate = totalSent > 0 ? (delivered / totalSent) * 100 : 0
  const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0
  const complaintRate = totalSent > 0 ? (complained / totalSent) * 100 : 0
  
  // Calculate health score (0-100)
  let healthScore = 100
  
  // Deduct points for high bounce rate
  if (bounceRate > 5) healthScore -= Math.min(30, bounceRate * 2)
  
  // Deduct points for high complaint rate
  if (complaintRate > 0.5) healthScore -= Math.min(25, complaintRate * 10)
  
  // Deduct points for low delivery rate
  if (deliveryRate < 95) healthScore -= Math.min(20, (95 - deliveryRate))
  
  // Generate issues and recommendations
  const issues: string[] = []
  const recommendations: string[] = []
  
  if (bounceRate > 5) {
    issues.push(`High bounce rate: ${bounceRate.toFixed(2)}%`)
    recommendations.push('Review email list quality and remove invalid addresses')
  }
  
  if (complaintRate > 0.5) {
    issues.push(`High complaint rate: ${complaintRate.toFixed(2)}%`)
    recommendations.push('Review email content and ensure proper consent')
  }
  
  if (deliveryRate < 90) {
    issues.push(`Low delivery rate: ${deliveryRate.toFixed(2)}%`)
    recommendations.push('Check sender reputation and email authentication')
  }
  
  if (suppressedCount > totalSent * 0.1) {
    issues.push(`High suppression list: ${suppressedCount} addresses`)
    recommendations.push('Review suppression reasons and improve consent management')
  }

  return {
    totalSent,
    totalDelivered: delivered,
    totalBounced: bounced,
    totalComplained: complained,
    totalSuppressed: suppressedCount,
    deliveryRate: Math.round(deliveryRate * 100) / 100,
    bounceRate: Math.round(bounceRate * 100) / 100,
    complaintRate: Math.round(complaintRate * 100) / 100,
    healthScore: Math.max(0, Math.round(healthScore)),
    issues,
    recommendations
  }
}

async function generateDetailedReport(supabase: any, cutoffTime: string, baseReport: MonitoringReport) {
  // Get template performance
  const { data: templateStats, error: templateError } = await supabase
    .from('communication_events')
    .select('template_id, status, email_type')
    .gte('created_at', cutoffTime)
    .neq('event_type', 'rate_limit_check')

  let templatePerformance = {}
  if (!templateError && templateStats) {
    templatePerformance = templateStats.reduce((acc: any, event: any) => {
      if (!event.template_id) return acc
      
      if (!acc[event.template_id]) {
        acc[event.template_id] = { sent: 0, failed: 0, emailType: event.email_type }
      }
      
      if (event.status === 'sent') {
        acc[event.template_id].sent++
      } else if (event.status === 'failed') {
        acc[event.template_id].failed++
      }
      
      return acc
    }, {})
  }

  // Get hourly breakdown
  const { data: hourlyStats, error: hourlyError } = await supabase
    .rpc('get_hourly_email_stats', { hours_back: 24 })

  return {
    ...baseReport,
    templatePerformance,
    hourlyBreakdown: hourlyError ? [] : hourlyStats,
    generatedAt: new Date().toISOString()
  }
}
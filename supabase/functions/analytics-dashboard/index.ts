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

    switch (path) {
      case 'api-health': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const timeframe = url.searchParams.get('timeframe') || '24h';
        const endTime = new Date();
        let startTime = new Date();

        // Calculate start time based on timeframe
        switch (timeframe) {
          case '1h':
            startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
            break;
          case '24h':
            startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get API request logs for the timeframe
        const { data: logs, error } = await supabase
          .from('api_request_logs')
          .select('*')
          .gte('created_at', startTime.toISOString())
          .lte('created_at', endTime.toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Process data for dashboard
        const dashboard = {
          timeframe,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          metrics: calculateAPIMetrics(logs || []),
          endpoints: analyzeEndpoints(logs || []),
          timeline: generateTimeline(logs || [], timeframe),
          alerts: await checkHealthAlerts(supabase, logs || [])
        };

        return new Response(JSON.stringify(dashboard), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'order-metrics': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const timeframe = url.searchParams.get('timeframe') || '24h';
        const endTime = new Date();
        let startTime = new Date();

        switch (timeframe) {
          case '24h':
            startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        }

        // Get order data
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .gte('created_at', startTime.toISOString())
          .lte('created_at', endTime.toISOString());

        if (ordersError) throw ordersError;

        // Get payment data
        const { data: payments, error: paymentsError } = await supabase
          .from('payment_transactions')
          .select('*')
          .gte('created_at', startTime.toISOString())
          .lte('created_at', endTime.toISOString());

        if (paymentsError) throw paymentsError;

        const metrics = {
          orders: {
            total: orders?.length || 0,
            completed: orders?.filter(o => o.status === 'delivered').length || 0,
            pending: orders?.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.status)).length || 0,
            cancelled: orders?.filter(o => o.status === 'cancelled').length || 0,
            averageValue: orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) / (orders?.length || 1),
            revenue: orders?.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0
          },
          payments: {
            total: payments?.length || 0,
            successful: payments?.filter(p => p.status === 'success').length || 0,
            failed: payments?.filter(p => p.status === 'failed').length || 0,
            pending: payments?.filter(p => p.status === 'pending').length || 0,
            successRate: (payments?.filter(p => p.status === 'success').length || 0) / (payments?.length || 1) * 100,
            totalAmount: payments?.filter(p => p.status === 'success').reduce((sum, p) => sum + (p.amount || 0), 0) || 0
          },
          timeline: generateOrderTimeline(orders || [], timeframe)
        };

        return new Response(JSON.stringify(metrics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'business-intelligence': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const period = url.searchParams.get('period') || '30d';
        
        const intelligence = await generateBusinessIntelligence(supabase, period);

        return new Response(JSON.stringify(intelligence), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'record-metric': {
        if (req.method !== 'POST') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const { endpoint, metricType, metricValue, dimensions } = await req.json();

        if (!endpoint || !metricType || metricValue === undefined) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: endpoint, metricType, metricValue' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: metric, error } = await supabase
          .from('api_metrics')
          .insert({
            endpoint,
            metric_type: metricType,
            metric_value: metricValue,
            dimensions: dimensions || {}
          })
          .select()
          .single();

        if (error) throw error;

        // Also update business analytics if this is a business metric
        if (['revenue', 'orders', 'customers'].includes(metricType)) {
          const now = new Date();
          const periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const periodEnd = new Date(periodStart.getTime() + 24 * 60 * 60 * 1000);

          await supabase
            .from('business_analytics')
            .upsert({
              metric_name: metricType,
              metric_value: metricValue,
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              dimensions: dimensions || {}
            }, {
              onConflict: 'metric_name,period_start'
            });
        }

        return new Response(JSON.stringify(metric), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'alerts': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const alerts = await generateAlerts(supabase);

        return new Response(JSON.stringify(alerts), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'daily-analytics': {
        if (req.method !== 'GET') {
          return new Response('Method not allowed', { status: 405, headers: corsHeaders });
        }

        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        
        const dailyAnalytics = await generateDailyAnalytics(supabase, startDate, endDate);

        return new Response(JSON.stringify(dailyAnalytics), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default: {
        return new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function calculateAPIMetrics(logs: any[]) {
  const total = logs.length;
  const successful = logs.filter(log => log.response_status < 400).length;
  const errors = logs.filter(log => log.response_status >= 400).length;
  const responseTimesMs = logs.map(log => log.response_time_ms || 0);
  
  responseTimesMs.sort((a, b) => a - b);
  
  return {
    totalRequests: total,
    successfulRequests: successful,
    errorRequests: errors,
    successRate: total > 0 ? (successful / total) * 100 : 0,
    errorRate: total > 0 ? (errors / total) * 100 : 0,
    averageResponseTime: responseTimesMs.length > 0 
      ? responseTimesMs.reduce((sum, time) => sum + time, 0) / responseTimesMs.length 
      : 0,
    p50ResponseTime: responseTimesMs[Math.floor(responseTimesMs.length * 0.5)] || 0,
    p95ResponseTime: responseTimesMs[Math.floor(responseTimesMs.length * 0.95)] || 0,
    p99ResponseTime: responseTimesMs[Math.floor(responseTimesMs.length * 0.99)] || 0
  };
}

function analyzeEndpoints(logs: any[]) {
  const endpointStats: { [key: string]: any } = {};

  logs.forEach(log => {
    const endpoint = log.endpoint || 'unknown';
    
    if (!endpointStats[endpoint]) {
      endpointStats[endpoint] = {
        endpoint,
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
        responseTimes: []
      };
    }

    endpointStats[endpoint].totalRequests++;
    
    if (log.response_status < 400) {
      endpointStats[endpoint].successfulRequests++;
    } else {
      endpointStats[endpoint].errorRequests++;
    }

    if (log.response_time_ms) {
      endpointStats[endpoint].responseTimes.push(log.response_time_ms);
    }
  });

  // Calculate derived metrics for each endpoint
  Object.values(endpointStats).forEach((stats: any) => {
    stats.successRate = stats.totalRequests > 0 
      ? (stats.successfulRequests / stats.totalRequests) * 100 
      : 0;
    stats.errorRate = stats.totalRequests > 0 
      ? (stats.errorRequests / stats.totalRequests) * 100 
      : 0;
    stats.averageResponseTime = stats.responseTimes.length > 0 
      ? stats.responseTimes.reduce((sum: number, time: number) => sum + time, 0) / stats.responseTimes.length 
      : 0;

    stats.responseTimes.sort((a: number, b: number) => a - b);
    stats.p95ResponseTime = stats.responseTimes[Math.floor(stats.responseTimes.length * 0.95)] || 0;
    
    delete stats.responseTimes; // Remove to reduce response size
  });

  return Object.values(endpointStats);
}

function generateTimeline(logs: any[], timeframe: string) {
  const buckets: { [key: string]: any } = {};
  let bucketSize: number;

  // Determine bucket size based on timeframe
  switch (timeframe) {
    case '1h':
      bucketSize = 5 * 60 * 1000; // 5 minutes
      break;
    case '24h':
      bucketSize = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      bucketSize = 4 * 60 * 60 * 1000; // 4 hours
      break;
    case '30d':
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      break;
    default:
      bucketSize = 60 * 60 * 1000; // 1 hour
  }

  logs.forEach(log => {
    const timestamp = new Date(log.created_at).getTime();
    const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
    const bucketTime = new Date(bucketKey).toISOString();

    if (!buckets[bucketTime]) {
      buckets[bucketTime] = {
        timestamp: bucketTime,
        totalRequests: 0,
        successfulRequests: 0,
        errorRequests: 0,
        responseTimes: []
      };
    }

    buckets[bucketTime].totalRequests++;
    
    if (log.response_status < 400) {
      buckets[bucketTime].successfulRequests++;
    } else {
      buckets[bucketTime].errorRequests++;
    }

    if (log.response_time_ms) {
      buckets[bucketTime].responseTimes.push(log.response_time_ms);
    }
  });

  // Calculate averages for each bucket
  const timeline = Object.values(buckets).map((bucket: any) => ({
    timestamp: bucket.timestamp,
    totalRequests: bucket.totalRequests,
    successfulRequests: bucket.successfulRequests,
    errorRequests: bucket.errorRequests,
    successRate: bucket.totalRequests > 0 ? (bucket.successfulRequests / bucket.totalRequests) * 100 : 0,
    averageResponseTime: bucket.responseTimes.length > 0 
      ? bucket.responseTimes.reduce((sum: number, time: number) => sum + time, 0) / bucket.responseTimes.length 
      : 0
  }));

  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function generateOrderTimeline(orders: any[], timeframe: string) {
  const buckets: { [key: string]: any } = {};
  let bucketSize: number;

  switch (timeframe) {
    case '24h':
      bucketSize = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '30d':
      bucketSize = 24 * 60 * 60 * 1000; // 1 day
      break;
    default:
      bucketSize = 60 * 60 * 1000;
  }

  orders.forEach(order => {
    const timestamp = new Date(order.created_at).getTime();
    const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;
    const bucketTime = new Date(bucketKey).toISOString();

    if (!buckets[bucketTime]) {
      buckets[bucketTime] = {
        timestamp: bucketTime,
        totalOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        revenue: 0
      };
    }

    buckets[bucketTime].totalOrders++;
    
    if (order.status === 'delivered') {
      buckets[bucketTime].completedOrders++;
      buckets[bucketTime].revenue += order.total_amount || 0;
    } else if (order.status === 'cancelled') {
      buckets[bucketTime].cancelledOrders++;
    }
  });

  const timeline = Object.values(buckets).map((bucket: any) => ({
    timestamp: bucket.timestamp,
    totalOrders: bucket.totalOrders,
    completedOrders: bucket.completedOrders,
    cancelledOrders: bucket.cancelledOrders,
    revenue: bucket.revenue,
    completionRate: bucket.totalOrders > 0 ? (bucket.completedOrders / bucket.totalOrders) * 100 : 0
  }));

  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

async function checkHealthAlerts(supabase: any, logs: any[]) {
  const alerts = [];
  
  // Check error rate
  const recentLogs = logs.filter(log => 
    new Date(log.created_at) > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
  );
  
  const errorRate = recentLogs.length > 0 
    ? (recentLogs.filter(log => log.response_status >= 400).length / recentLogs.length) * 100 
    : 0;

  if (errorRate > 10) {
    alerts.push({
      type: 'error_rate',
      severity: errorRate > 25 ? 'critical' : 'warning',
      message: `High error rate: ${errorRate.toFixed(1)}% in the last 15 minutes`,
      value: errorRate,
      timestamp: new Date().toISOString()
    });
  }

  // Check response time
  const responseTimes = recentLogs
    .filter(log => log.response_time_ms)
    .map(log => log.response_time_ms);

  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    if (avgResponseTime > 2000) {
      alerts.push({
        type: 'response_time',
        severity: avgResponseTime > 5000 ? 'critical' : 'warning',
        message: `High average response time: ${avgResponseTime.toFixed(0)}ms in the last 15 minutes`,
        value: avgResponseTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Check for security incidents
  const { data: recentIncidents } = await supabase
    .from('security_incidents')
    .select('*')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

  if (recentIncidents && recentIncidents.length > 5) {
    alerts.push({
      type: 'security',
      severity: recentIncidents.length > 20 ? 'critical' : 'warning',
      message: `High number of security incidents: ${recentIncidents.length} in the last hour`,
      value: recentIncidents.length,
      timestamp: new Date().toISOString()
    });
  }

  return alerts;
}

async function generateBusinessIntelligence(supabase: any, period: string) {
  const endTime = new Date();
  let startTime = new Date();

  switch (period) {
    case '7d':
      startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startTime = new Date(endTime.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get comprehensive data
  const [
    { data: orders },
    { data: customers },
    { data: payments },
    { data: analytics }
  ] = await Promise.all([
    supabase.from('orders').select('*').gte('created_at', startTime.toISOString()),
    supabase.from('customers').select('*').gte('created_at', startTime.toISOString()),
    supabase.from('payment_transactions').select('*').gte('created_at', startTime.toISOString()),
    supabase.from('customer_purchase_analytics').select('*')
  ]);

  // Revenue analytics
  const totalRevenue = orders?.filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  
  const avgOrderValue = orders?.length > 0 
    ? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length 
    : 0;

  // Customer analytics
  const newCustomers = customers?.length || 0;
  const returningCustomers = analytics?.filter(a => a.total_orders > 1).length || 0;
  
  // Customer segmentation
  const customerSegments = {
    vip: analytics?.filter(a => a.total_spent > 1000).length || 0,
    regular: analytics?.filter(a => a.total_spent > 100 && a.total_spent <= 1000).length || 0,
    occasional: analytics?.filter(a => a.total_spent <= 100).length || 0
  };

  // Product performance (top selling)
  const productSales: { [key: string]: any } = {};
  orders?.forEach(order => {
    // This would need order_items join in a real implementation
    // For now, we'll simulate some data
  });

  // Growth trends
  const growthTrends = generateGrowthTrends(orders || [], period);

  return {
    period,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    revenue: {
      total: totalRevenue,
      averageOrderValue: avgOrderValue,
      trends: growthTrends.revenue
    },
    customers: {
      new: newCustomers,
      returning: returningCustomers,
      segments: customerSegments,
      retentionRate: analytics?.length > 0 ? (returningCustomers / analytics.length) * 100 : 0
    },
    orders: {
      total: orders?.length || 0,
      completed: orders?.filter(o => o.status === 'delivered').length || 0,
      cancelled: orders?.filter(o => o.status === 'cancelled').length || 0,
      trends: growthTrends.orders
    },
    payments: {
      total: payments?.length || 0,
      successful: payments?.filter(p => p.status === 'success').length || 0,
      successRate: payments?.length > 0 
        ? (payments.filter(p => p.status === 'success').length / payments.length) * 100 
        : 0
    },
    insights: generateInsights(orders || [], customers || [], analytics || [])
  };
}

function generateGrowthTrends(orders: any[], period: string) {
  // Simple growth calculation - would be more sophisticated in production
  const midPoint = new Date(Date.now() - (period === '30d' ? 15 : 45) * 24 * 60 * 60 * 1000);
  
  const firstHalf = orders.filter(o => new Date(o.created_at) < midPoint);
  const secondHalf = orders.filter(o => new Date(o.created_at) >= midPoint);

  const revenueGrowth = firstHalf.length > 0 
    ? ((secondHalf.length - firstHalf.length) / firstHalf.length) * 100 
    : 0;

  return {
    revenue: {
      growth: revenueGrowth,
      direction: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'flat'
    },
    orders: {
      growth: revenueGrowth, // Simplified - would calculate separately
      direction: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'flat'
    }
  };
}

function generateInsights(orders: any[], customers: any[], analytics: any[]) {
  const insights = [];

  // Peak hour analysis
  const hourCounts: { [key: number]: number } = {};
  orders.forEach(order => {
    const hour = new Date(order.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHour = Object.entries(hourCounts).reduce((max, [hour, count]) => 
    count > max.count ? { hour: parseInt(hour), count } : max, 
    { hour: 0, count: 0 }
  );

  if (peakHour.count > 0) {
    insights.push({
      type: 'peak_hours',
      message: `Peak ordering time is ${peakHour.hour}:00 with ${peakHour.count} orders`,
      recommendation: 'Consider staffing adjustments during peak hours'
    });
  }

  // Customer retention
  const repeatCustomerRate = analytics.length > 0 
    ? (analytics.filter(a => a.total_orders > 1).length / analytics.length) * 100 
    : 0;

  if (repeatCustomerRate < 30) {
    insights.push({
      type: 'retention',
      message: `Low customer retention rate: ${repeatCustomerRate.toFixed(1)}%`,
      recommendation: 'Implement loyalty programs or follow-up campaigns'
    });
  }

  // Average order value trends
  const avgOrderValue = orders.length > 0 
    ? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length 
    : 0;

  if (avgOrderValue < 25) {
    insights.push({
      type: 'order_value',
      message: `Low average order value: $${avgOrderValue.toFixed(2)}`,
      recommendation: 'Consider upselling strategies or bundle offers'
    });
  }

  return insights;
}

async function generateAlerts(supabase: any) {
  const alerts = [];
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Check API health alerts
  const { data: recentLogs } = await supabase
    .from('api_request_logs')
    .select('*')
    .gte('created_at', oneHourAgo.toISOString());

  if (recentLogs && recentLogs.length > 0) {
    const errorRate = (recentLogs.filter(log => log.response_status >= 400).length / recentLogs.length) * 100;
    
    if (errorRate > 5) {
      alerts.push({
        id: `error_rate_${now.getTime()}`,
        type: 'api_health',
        severity: errorRate > 15 ? 'critical' : 'warning',
        title: 'High API Error Rate',
        message: `${errorRate.toFixed(1)}% of API requests failed in the last hour`,
        timestamp: now.toISOString(),
        actions: [
          'Check server logs for details',
          'Verify database connectivity',
          'Review recent deployments'
        ]
      });
    }
  }

  // Check for security incidents
  const { data: recentIncidents } = await supabase
    .from('security_incidents')
    .select('*')
    .gte('created_at', oneHourAgo.toISOString());

  if (recentIncidents && recentIncidents.length > 3) {
    alerts.push({
      id: `security_${now.getTime()}`,
      type: 'security',
      severity: 'high',
      title: 'Multiple Security Incidents',
      message: `${recentIncidents.length} security incidents detected in the last hour`,
      timestamp: now.toISOString(),
      actions: [
        'Review incident details',
        'Check for IP patterns',
        'Consider blocking suspicious IPs'
      ]
    });
  }

  // Check payment issues
  const { data: recentPayments } = await supabase
    .from('payment_transactions')
    .select('*')
    .gte('created_at', oneHourAgo.toISOString());

  if (recentPayments && recentPayments.length > 0) {
    const failureRate = (recentPayments.filter(p => p.status === 'failed').length / recentPayments.length) * 100;
    
    if (failureRate > 10) {
      alerts.push({
        id: `payment_${now.getTime()}`,
        type: 'payment',
        severity: failureRate > 25 ? 'critical' : 'warning',
        title: 'High Payment Failure Rate',
        message: `${failureRate.toFixed(1)}% of payments failed in the last hour`,
        timestamp: now.toISOString(),
        actions: [
          'Check payment gateway status',
          'Verify API credentials',
          'Review failed payment logs'
        ]
      });
    }
  }

  return alerts;
}

async function generateDailyAnalytics(supabase: any, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Get all orders in the date range
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .gte('order_time', `${startDate}T00:00:00.000Z`)
    .lte('order_time', `${endDate}T23:59:59.999Z`)
    .eq('payment_status', 'paid')
    .order('order_time', { ascending: true });

  if (ordersError) {
    console.error('Error fetching orders for daily analytics:', ordersError);
    return { dailyData: [], summary: { totalDays: 0, totalRevenue: 0, totalOrders: 0, totalCustomers: 0 } };
  }

  // Get order items to find top products
  const orderIds = orders?.map(o => o.id) || [];
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id, product_id, quantity, products(name)')
    .in('order_id', orderIds);

  // Group data by day
  const dailyMap: { [key: string]: any } = {};
  
  // Initialize all days in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    dailyMap[dateKey] = {
      date: dateKey,
      revenue: 0,
      orders: 0,
      customers: new Set(),
      products: {} as { [key: string]: { name: string; quantity: number } },
      previousRevenue: 0
    };
  }

  // Aggregate orders data
  (orders || []).forEach(order => {
    const orderDate = new Date(order.order_time);
    const dateKey = orderDate.toISOString().split('T')[0];
    
    if (dailyMap[dateKey]) {
      dailyMap[dateKey].revenue += order.total_amount || 0;
      dailyMap[dateKey].orders += 1;
      
      if (order.customer_email) {
        dailyMap[dateKey].customers.add(order.customer_email);
      }
    }
  });

  // Aggregate product data
  (orderItems || []).forEach(item => {
    const order = orders?.find(o => o.id === item.order_id);
    if (order) {
      const orderDate = new Date(order.order_time);
      const dateKey = orderDate.toISOString().split('T')[0];
      
      if (dailyMap[dateKey] && item.products?.name) {
        const productName = item.products.name;
        if (!dailyMap[dateKey].products[productName]) {
          dailyMap[dateKey].products[productName] = { name: productName, quantity: 0 };
        }
        dailyMap[dateKey].products[productName].quantity += item.quantity || 0;
      }
    }
  });

  // Calculate growth and format data
  const sortedDates = Object.keys(dailyMap).sort();
  const dailyData = sortedDates.map((dateKey, index) => {
    const day = dailyMap[dateKey];
    const previousDay = index > 0 ? dailyMap[sortedDates[index - 1]] : null;
    
    // Calculate growth percentage
    let growthPercentage = 0;
    if (previousDay && previousDay.revenue > 0) {
      growthPercentage = ((day.revenue - previousDay.revenue) / previousDay.revenue) * 100;
    }

    // Get top 3 products for the day
    const topProducts = Object.values(day.products)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 3)
      .map((p: any) => ({ name: p.name, quantity: p.quantity }));

    return {
      date: dateKey,
      revenue: day.revenue,
      orders: day.orders,
      customers: day.customers.size,
      topProducts,
      growth: growthPercentage,
      growthDirection: growthPercentage > 0 ? 'up' : growthPercentage < 0 ? 'down' : 'flat'
    };
  });

  // Calculate summary
  const summary = {
    totalDays: dailyData.length,
    totalRevenue: dailyData.reduce((sum, day) => sum + day.revenue, 0),
    totalOrders: dailyData.reduce((sum, day) => sum + day.orders, 0),
    totalCustomers: new Set(dailyData.flatMap(day => 
      orders?.filter(o => o.order_time.startsWith(day.date)).map(o => o.customer_email) || []
    )).size,
    averageDailyRevenue: dailyData.length > 0 
      ? dailyData.reduce((sum, day) => sum + day.revenue, 0) / dailyData.length 
      : 0,
    averageDailyOrders: dailyData.length > 0 
      ? dailyData.reduce((sum, day) => sum + day.orders, 0) / dailyData.length 
      : 0
  };

  return {
    dailyData,
    summary,
    dateRange: { startDate, endDate }
  };
}
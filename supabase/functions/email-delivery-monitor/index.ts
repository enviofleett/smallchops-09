import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;
  totalComplained: number;
  totalSuppressed: number;
  deliveryRate: number;
  bounceRate: number;
  complaintRate: number;
  healthScore: number;
  issues: string[];
  recommendations: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 Email delivery monitor started');

    const { timeframe = '24h' } = await req.json().catch(() => ({}));

    // Calculate time window based on timeframe
    let hoursBack = 24;
    switch (timeframe) {
      case '1h': hoursBack = 1; break;
      case '6h': hoursBack = 6; break;
      case '24h': hoursBack = 24; break;
      case '7d': hoursBack = 24 * 7; break;
      case '30d': hoursBack = 24 * 30; break;
    }

    const timeWindow = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    // Fetch communication events data
    const { data: events, error: eventsError } = await supabase
      .from('communication_events')
      .select('status, event_type, error_message, sent_at')
      .gte('created_at', timeWindow);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    // Fetch bounce tracking data
    const { data: bounces, error: bouncesError } = await supabase
      .from('email_bounce_tracking')
      .select('bounce_type, email_address')
      .gte('created_at', timeWindow);

    if (bouncesError) {
      console.error('Error fetching bounces:', bouncesError);
    }

    // Fetch suppression data
    const { data: suppressions, error: suppressionsError } = await supabase
      .from('email_suppression_list')
      .select('email, suppression_type')
      .eq('is_active', true);

    if (suppressionsError) {
      console.error('Error fetching suppressions:', suppressionsError);
    }

    // Calculate metrics
    const totalEvents = events?.length || 0;
    const sentEvents = events?.filter(e => e.status === 'sent') || [];
    const failedEvents = events?.filter(e => e.status === 'failed') || [];
    const totalSent = sentEvents.length;
    const totalFailed = failedEvents.length;
    
    const totalBounced = bounces?.length || 0;
    const hardBounces = bounces?.filter(b => b.bounce_type === 'hard').length || 0;
    const softBounces = bounces?.filter(b => b.bounce_type === 'soft').length || 0;
    
    const totalSuppressed = suppressions?.length || 0;
    const complaintsCount = suppressions?.filter(s => s.suppression_type === 'complaint').length || 0;

    // Calculate rates
    const deliveryRate = totalSent > 0 ? ((totalSent / (totalSent + totalFailed)) * 100) : 100;
    const bounceRate = totalSent > 0 ? ((totalBounced / totalSent) * 100) : 0;
    const complaintRate = totalSent > 0 ? ((complaintsCount / totalSent) * 100) : 0;

    // Calculate health score (0-100)
    let healthScore = 100;
    if (bounceRate > 5) healthScore -= (bounceRate - 5) * 5; // Penalize bounce rate > 5%
    if (complaintRate > 0.5) healthScore -= (complaintRate - 0.5) * 10; // Penalize complaint rate > 0.5%
    if (deliveryRate < 95) healthScore -= (95 - deliveryRate) * 2; // Penalize delivery rate < 95%
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Generate issues and recommendations
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (bounceRate > 5) {
      issues.push(`High bounce rate: ${bounceRate.toFixed(2)}%`);
      recommendations.push('Review email list quality and validation processes');
    }

    if (complaintRate > 0.5) {
      issues.push(`High complaint rate: ${complaintRate.toFixed(2)}%`);
      recommendations.push('Review email content and frequency');
    }

    if (deliveryRate < 95) {
      issues.push(`Low delivery rate: ${deliveryRate.toFixed(2)}%`);
      recommendations.push('Check SMTP configuration and authentication');
    }

    if (hardBounces > 10) {
      issues.push(`${hardBounces} hard bounces detected`);
      recommendations.push('Implement automatic suppression for hard bounces');
    }

    if (totalSuppressed > 50) {
      issues.push(`${totalSuppressed} emails currently suppressed`);
      recommendations.push('Review and clean suppression list regularly');
    }

    const metrics: EmailMetrics = {
      totalSent,
      totalDelivered: totalSent, // Assuming sent = delivered for now
      totalBounced,
      totalComplained: complaintsCount,
      totalSuppressed,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 100) / 100,
      healthScore: Math.round(healthScore),
      issues,
      recommendations
    };

    console.log('📊 Email metrics calculated:', {
      timeframe,
      totalEvents,
      totalSent,
      healthScore: metrics.healthScore,
      issuesCount: issues.length
    });

    return new Response(JSON.stringify({
      success: true,
      report: metrics,
      metadata: {
        timeframe,
        calculatedAt: new Date().toISOString(),
        windowStart: timeWindow
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email delivery monitor:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Error generating email delivery report'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check customer account creation completeness
    const { data: accountStats } = await supabaseClient
      .from('customer_accounts')
      .select('id, user_id, email_verified, phone')
      .order('created_at', { ascending: false })
      .limit(100);

    // Check order-customer linking status
    const { data: orderLinkingStats } = await supabaseClient.rpc('get_order_linking_stats');

    // Check email delivery status
    const { data: emailStats } = await supabaseClient
      .from('communication_events')
      .select('status, event_type')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check authentication health
    const { count: recentAccounts } = await supabaseClient
      .from('customer_accounts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Process stuck emails if any
    if (emailStats?.some(e => e.status === 'queued')) {
      const { data: processResult } = await supabaseClient.rpc('process_stuck_emails');
      console.log('Processed stuck emails:', processResult);
    }

    const emailStatusCounts = emailStats?.reduce((acc: any, event: any) => {
      acc[event.status] = (acc[event.status] || 0) + 1;
      return acc;
    }, {});

    const report = {
      timestamp: new Date().toISOString(),
      customer_accounts: {
        total_recent: recentAccounts || 0,
        with_phone: accountStats?.filter(a => a.phone).length || 0,
        email_verified: accountStats?.filter(a => a.email_verified).length || 0,
        completion_rate: accountStats?.length ? 
          (accountStats.filter(a => a.phone && a.email_verified).length / accountStats.length * 100).toFixed(1) + '%' : '0%'
      },
      order_linking: orderLinkingStats || {},
      email_delivery: {
        last_24h_total: emailStats?.length || 0,
        status_breakdown: emailStatusCounts || {},
        stuck_emails_processed: emailStats?.filter(e => e.status === 'queued').length || 0
      },
      health_score: calculateHealthScore(accountStats, emailStats, recentAccounts),
      recommendations: generateRecommendations(accountStats, emailStats)
    };

    console.log('Production Customer System Monitor Report:', report);

    // Log to audit for tracking
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'production_system_monitor',
        category: 'System Health',
        message: `System health check completed - Score: ${report.health_score}`,
        new_values: report
      });

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Production monitor error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function calculateHealthScore(accounts: any[], emails: any[], recentAccounts: number): number {
  let score = 100;
  
  // Deduct for low account completion
  const completionRate = accounts?.length ? 
    accounts.filter(a => a.phone && a.email_verified).length / accounts.length : 0;
  if (completionRate < 0.8) score -= 20;
  
  // Deduct for stuck emails
  const stuckEmails = emails?.filter(e => e.status === 'queued').length || 0;
  if (stuckEmails > 5) score -= 15;
  
  // Deduct for failed emails
  const failedEmails = emails?.filter(e => e.status === 'failed').length || 0;
  if (failedEmails > 3) score -= 10;
  
  // Deduct for low activity
  if (recentAccounts < 1) score -= 5;
  
  return Math.max(score, 0);
}

function generateRecommendations(accounts: any[], emails: any[]): string[] {
  const recommendations = [];
  
  const completionRate = accounts?.length ? 
    accounts.filter(a => a.phone && a.email_verified).length / accounts.length : 0;
  
  if (completionRate < 0.8) {
    recommendations.push('Improve customer onboarding flow - low profile completion rate');
  }
  
  const stuckEmails = emails?.filter(e => e.status === 'queued').length || 0;
  if (stuckEmails > 5) {
    recommendations.push('Check email processing system - high number of stuck emails');
  }
  
  const failedEmails = emails?.filter(e => e.status === 'failed').length || 0;
  if (failedEmails > 3) {
    recommendations.push('Review email delivery configuration - high failure rate');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('System operating optimally');
  }
  
  return recommendations;
}
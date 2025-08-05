import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Email automation cron job started');

    const results: Record<string, any> = {};

    // 1. Process cart abandonment
    try {
      console.log('Processing cart abandonment...');
      const { data: cartResult, error: cartError } = await supabase.functions.invoke('cart-abandonment-processor');
      
      if (cartError) {
        console.error('Cart abandonment error:', cartError);
        results.cart_abandonment = { error: cartError.message };
      } else {
        results.cart_abandonment = cartResult;
        console.log('Cart abandonment result:', cartResult);
      }
    } catch (error) {
      console.error('Cart abandonment processor failed:', error);
      results.cart_abandonment = { error: error.message };
    }

    // 2. Process welcome series
    try {
      console.log('Processing welcome series...');
      const { data: welcomeResult, error: welcomeError } = await supabase.functions.invoke('welcome-series-processor');
      
      if (welcomeError) {
        console.error('Welcome series error:', welcomeError);
        results.welcome_series = { error: welcomeError.message };
      } else {
        results.welcome_series = welcomeResult;
        console.log('Welcome series result:', welcomeResult);
      }
    } catch (error) {
      console.error('Welcome series processor failed:', error);
      results.welcome_series = { error: error.message };
    }

    // 3. Process review requests
    try {
      console.log('Processing review requests...');
      const { data: reviewResult, error: reviewError } = await supabase.functions.invoke('review-request-processor');
      
      if (reviewError) {
        console.error('Review request error:', reviewError);
        results.review_requests = { error: reviewError.message };
      } else {
        results.review_requests = reviewResult;
        console.log('Review request result:', reviewResult);
      }
    } catch (error) {
      console.error('Review request processor failed:', error);
      results.review_requests = { error: error.message };
    }

    // 4. Trigger main email processors to handle all queued emails
    try {
      console.log('Triggering main email processors...');
      
      // Trigger enhanced email processor
      const { data: enhancedResult, error: enhancedError } = await supabase.functions.invoke('enhanced-email-processor', {
        body: { priority: 'all' }
      });

      if (enhancedError) {
        console.error('Enhanced email processor error:', enhancedError);
      }

      // Also trigger instant processor as backup
      const { data: instantResult, error: instantError } = await supabase.functions.invoke('instant-email-processor', {
        body: { priority: 'all' }
      });

      if (instantError) {
        console.error('Instant email processor error:', instantError);
      }

      results.email_processing = {
        enhanced: enhancedResult || { triggered: true },
        instant: instantResult || { triggered: true }
      };

    } catch (error) {
      console.error('Email processor triggering failed:', error);
      results.email_processing = { error: error.message };
    }

    // 5. Log automation run
    await supabase
      .from('audit_logs')
      .insert({
        action: 'email_automation_cron_run',
        category: 'Email Automation',
        message: 'Completed scheduled email automation run',
        new_values: {
          run_time: new Date().toISOString(),
          results: results
        }
      });

    console.log('Email automation cron job completed');

    // Calculate summary
    const summary = {
      total_processors: 3,
      successful_processors: Object.values(results).filter(r => r && !r.error).length,
      failed_processors: Object.values(results).filter(r => r && r.error).length,
      cart_abandonment_processed: results.cart_abandonment?.processed || 0,
      welcome_series_processed: results.welcome_series?.processed || 0,
      review_requests_processed: results.review_requests?.processed || 0,
      total_emails_queued: (results.cart_abandonment?.emails_queued || 0) + 
                          (results.welcome_series?.emails_queued || 0) + 
                          (results.review_requests?.emails_queued || 0)
    };

    return new Response(JSON.stringify({
      success: true,
      message: 'Email automation cron job completed',
      summary,
      detailed_results: results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email automation cron:', error);
    
    // Still try to log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase
        .from('audit_logs')
        .insert({
          action: 'email_automation_cron_error',
          category: 'Email Automation',
          message: 'Email automation cron job failed',
          new_values: {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      error: error.message,
      details: 'Error in email automation cron job'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
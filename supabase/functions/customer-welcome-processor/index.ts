import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { customer_email, customer_name, trigger_type = 'registration' } = await req.json();

    console.log('Processing welcome email for:', customer_email);

    // Send welcome email using template service
    await supabaseAdmin.functions.invoke('production-smtp-sender', {
      body: {
        to: customer_email,
        template_key: 'customer_welcome',
        variables: {
          customer_name: customer_name,
          customer_email: customer_email,
          store_name: 'Your Store',
          store_url: 'https://your-store.com',
          support_email: 'support@your-store.com',
          welcome_date: new Date().toLocaleDateString()
        },
        priority: 'normal'
      }
    });

    console.log('Welcome email sent to:', customer_email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Welcome email processing error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send welcome email'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
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

    // Send welcome email using native SMTP system only
    await supabaseAdmin.functions.invoke('unified-smtp-sender', {
      body: {
        to: customer_email,
        templateKey: 'customer_welcome',
        variables: {
          customerName: customer_name || split_part(customer_email, '@', 1),
          customerEmail: customer_email,
          welcomeDate: new Date().toLocaleDateString()
        },
        emailType: 'transactional'
      }
    });
    
    console.log('Welcome email sent via Native SMTP to:', customer_email);

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
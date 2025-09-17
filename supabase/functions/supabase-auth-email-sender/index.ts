import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// AUTH EMAIL SENDER - DISABLED  
// This function has been disabled to avoid interference with native SMTP configuration
// All email traffic should use unified-smtp-sender directly

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`🚫 AUTH EMAIL SENDER - DISABLED: ${req.method} request rejected`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Return error for all requests
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Auth email sender disabled. Use unified-smtp-sender directly.',
      message: 'This auth email function has been disabled to prevent configuration conflicts with native SMTP. Please update your code to use unified-smtp-sender directly.',
      migration_guide: {
        before: 'supabase.functions.invoke("supabase-auth-email-sender", { body: { templateId, to, variables } })',
        after: 'supabase.functions.invoke("unified-smtp-sender", { body: { templateKey: templateId, to, variables } })'
      },
      timestamp: new Date().toISOString()
    }),
    { 
      status: 410, // Gone
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
});
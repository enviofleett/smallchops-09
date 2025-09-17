import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// LEGACY EMAIL SENDER - DISABLED
// This function has been disabled to avoid interference with native SMTP configuration
// All email traffic should use unified-smtp-sender directly

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  console.log(`🚫 LEGACY SMTP SENDER - DISABLED: ${req.method} request rejected`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Return error for all requests
  return new Response(JSON.stringify({
    success: false,
    error: 'Legacy SMTP sender disabled. Use unified-smtp-sender directly.',
    message: 'This legacy email function has been disabled to prevent configuration conflicts. Please update your code to use unified-smtp-sender directly.',
    migration_guide: {
      before: 'supabase.functions.invoke("smtp-email-sender", { body: emailData })',
      after: 'supabase.functions.invoke("unified-smtp-sender", { body: emailData })'
    },
    timestamp: new Date().toISOString()
  }), {
    status: 410, // Gone
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
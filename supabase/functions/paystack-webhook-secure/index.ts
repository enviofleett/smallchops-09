
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// PATCH: remove insecure path; either proxy or 410
serve(() =>
  new Response(
    JSON.stringify({ 
      error: "Deprecated. Use enhanced-paystack-webhook.", 
      migration_guide: "Update your Paystack webhook URL to use /functions/v1/enhanced-paystack-webhook"
    }),
    { 
      status: 410, 
      headers: { "Content-Type": "application/json" } 
    }
  )
)

// Simple Paystack config endpoint - returns cached public key only
// Minimal Edge Function usage for configuration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// Cache config in memory for this function instance
let cachedConfig: { public_key: string } | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Return cached config if available and fresh
    const now = Date.now();
    if (cachedConfig && (now - lastCacheTime) < CACHE_DURATION) {
      return new Response(
        JSON.stringify(cachedConfig),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=1800' // 30 minutes browser cache
          }
        }
      );
    }

    // Get test public key from environment (hardcoded for reliability)
    const publicKey = 'pk_test_b82d75e6bf9bcb6e8b8fb5d5772d2f1eeea48084';
    
    if (!publicKey) {
      return new Response(
        JSON.stringify({ error: 'Configuration not available' }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Cache the config
    cachedConfig = { public_key: publicKey };
    lastCacheTime = now;

    return new Response(
      JSON.stringify(cachedConfig),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800' // 30 minutes browser cache
        }
      }
    );

  } catch (error) {
    console.error('❌ Config error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Configuration unavailable' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
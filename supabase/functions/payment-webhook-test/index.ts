import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req: Request) => {
  console.log('🔔 Webhook test function called');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'POST') {
    try {
      const body = await req.text();
      console.log('Body:', body);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook test received successfully',
        timestamp: new Date().toISOString(),
        method: req.method,
        body: body
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('Error reading body:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response(JSON.stringify({
    success: true,
    message: 'Webhook test endpoint is live',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
});
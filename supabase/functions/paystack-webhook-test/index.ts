
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface TestRequestBody {
  mode: 'reference' | 'custom';
  reference?: string;
  payload?: any;
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  // Create clients: one with user auth (for admin check) and one with service role (for DB ops)
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const authHeader = req.headers.get('authorization') ?? '';

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  try {
    const body = (await req.json()) as TestRequestBody;

    // Basic validation
    if (!body || (body.mode !== 'reference' && body.mode !== 'custom')) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid request: specify mode as reference or custom' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Require admin
    const { data: isAdmin, error: adminErr } = await supabaseUser.rpc('is_admin');
    if (adminErr) {
      console.error('is_admin check failed', adminErr);
      return new Response(JSON.stringify({ success: false, error: 'Auth check failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct payload
    let payload: any;
    if (body.mode === 'reference') {
      if (!body.reference || !body.reference.trim()) {
        return new Response(JSON.stringify({ success: false, error: 'Reference is required for reference mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const now = new Date().toISOString();
      payload = {
        event: 'charge.success',
        data: {
          id: `${Date.now()}`,
          reference: body.reference.trim(),
          amount: 100000,
          status: 'success',
          gateway_response: 'Successful',
          paid_at: now,
          channel: 'card',
          fees: 0,
          authorization: {
            authorization_code: 'AUTH_test_123',
            card_type: 'visa',
            last4: '4242',
            exp_month: '12',
            exp_year: '29',
            bank: 'Test Bank',
          },
          customer: {
            email: 'test@example.com',
            customer_code: 'CUS_test',
          },
          metadata: {
            test: true,
            source: 'webhook-test-harness',
          },
        },
      };
    } else {
      // custom mode
      if (!body.payload) {
        return new Response(JSON.stringify({ success: false, error: 'payload is required for custom mode' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      payload = body.payload;
      if (!payload.event || !payload.data) {
        return new Response(JSON.stringify({ success: false, error: 'payload must include event and data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Ensure required keys for event_id composition
      payload.data.id = payload.data.id ?? `${Date.now()}`;
      payload.data.reference = payload.data.reference ?? `test_${Date.now()}`;
    }

    // Create a synthetic webhook event record
    const eventId = `${payload.event}-${payload.data.reference}-${payload.data.id}`;

    // Insert into webhook_events for tracking
    const { error: insertErr } = await supabaseAdmin.from('webhook_events').insert({
      paystack_event_id: eventId,
      event_type: payload.event,
      event_data: payload,
      processed: false,
      created_at: new Date(),
    });
    if (insertErr) {
      console.error('Failed to insert webhook_events', insertErr);
    }

    // Process success path similar to real webhook for charge.success
    let processing_result: any = { success: true, message: 'Event queued (no-op)' };
    if (payload.event === 'charge.success') {
      try {
        const r = await supabaseAdmin.rpc('handle_successful_payment', {
          p_reference: payload.data.reference,
          p_paid_at: (payload.data.paid_at ? new Date(payload.data.paid_at) : new Date()).toISOString(),
          p_gateway_response: payload.data.gateway_response ?? 'Successful',
          p_fees: payload.data.fees ? payload.data.fees / 100 : 0,
          p_channel: payload.data.channel ?? 'card',
          p_authorization_code: payload.data.authorization?.authorization_code ?? null,
          p_card_type: payload.data.authorization?.card_type ?? null,
          p_last4: payload.data.authorization?.last4 ?? null,
          p_exp_month: payload.data.authorization?.exp_month ?? null,
          p_exp_year: payload.data.authorization?.exp_year ?? null,
          p_bank: payload.data.authorization?.bank ?? null,
        });
        if (r.error) throw r.error;
        processing_result = { success: true, message: 'Payment handler executed' };
      } catch (e: any) {
        processing_result = { success: false, message: e?.message || 'Handler error' };
      }
    }

    // Update webhook_events as processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date(), processing_result })
      .eq('paystack_event_id', eventId);

    return new Response(
      JSON.stringify({ success: true, event_id: eventId, processed: true, payload }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('webhook-test error', error);
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

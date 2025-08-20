
// PATCH: strict signature verification using active secret key

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts"
import { getPaystackConfig } from "../_shared/paystack-config.ts"

// Utility: hex encode
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("")

// HMAC-SHA512
const hmacSha512 = async (key: string, msg: string | Uint8Array) => {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, typeof msg === "string" ? enc.encode(msg) : msg)
  return toHex(signature)
}

serve(async (req) => {
  const cors = getCorsHeaders(req)
  const pre = handleCorsPreflight(req)
  if (pre) return new Response(null, { status: 204, headers: cors })

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  try {
    // RAW body needed for signature verification
    const raw = new Uint8Array(await req.arrayBuffer())
    const bodyText = new TextDecoder().decode(raw)

    const incomingSig = (req.headers.get("x-paystack-signature") ?? "").toLowerCase().trim()
    if (!incomingSig) {
      console.warn("Missing Paystack signature")
      return new Response("Missing signature", { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const { secretKey, mode } = getPaystackConfig(req) // <-- active mode key
    const expected = await hmacSha512(secretKey, bodyText)

    if (incomingSig !== expected) {
      // Do NOT accept based on IP - enforce signature verification
      console.warn("Invalid Paystack signature:", {
        mode,
        expected_length: expected.length,
        incoming_length: incomingSig.length,
        match: false
      })
      return new Response("Unauthorized", { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    console.log("✅ Paystack signature verified successfully:", { mode })

    // Safe to parse after verification
    const evt = JSON.parse(bodyText)
    
    console.log("📨 Webhook event received:", {
      event: evt.event,
      reference: evt?.data?.reference,
      amount_kobo: evt?.data?.amount,
      status: evt?.data?.status,
      mode
    })

    // Only process successful charge events
    if (evt.event !== "charge.success" || evt?.data?.status !== "success") {
      console.log("ℹ️ Ignoring non-success event:", evt.event)
      return new Response("Event ignored", { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Normalize amounts: Paystack sends kobo, we store Naira
    const amountNaira = Math.round(Number(evt?.data?.amount ?? 0)) / 100
    const reference = evt?.data?.reference

    if (!reference) {
      console.warn("Missing reference in webhook data")
      return new Response("Missing reference", { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // Idempotent transaction update
    const { error: txError } = await supabaseClient
      .from('payment_transactions')
      .update({
        status: 'paid',
        paid_at: evt?.data?.paid_at || new Date().toISOString(),
        gateway_response: evt?.data?.gateway_response || 'Payment successful',
        fees: evt?.data?.fees ? evt?.data?.fees / 100 : 0,
        channel: evt?.data?.channel,
        provider_response: JSON.stringify(evt),
        processed_at: new Date().toISOString()
      })
      .eq('provider_reference', reference)

    if (txError) {
      console.error("Failed to update payment transaction:", txError)
    } else {
      console.log("✅ Payment transaction updated:", { reference, amount_naira: amountNaira })
    }

    // Idempotent order update
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: evt?.data?.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('payment_reference', reference)
      .select('id, order_number')
      .single()

    if (orderError) {
      console.error("Failed to update order:", orderError)
    } else if (order) {
      console.log("✅ Order confirmed:", { order_id: order.id, order_number: order.order_number })
      
      // Queue communication event for order confirmation
      await supabaseClient
        .from('communication_events')
        .insert({
          order_id: order.id,
          event_type: 'order_confirmed',
          payload: {
            order_number: order.order_number,
            reference,
            amount: amountNaira,
            webhook_processed: true
          }
        })
    }

    // Log successful webhook processing
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'webhook_processed',
        category: 'Payment',
        message: `Paystack webhook processed successfully: ${reference}`,
        new_values: {
          reference,
          amount_naira: amountNaira,
          event_type: evt.event,
          mode
        }
      })

    // Return 200 even if business update already applied (idempotent)
    return new Response("OK", { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error("❌ Webhook processing error:", e)
    // Return 200 to avoid infinite retries; log for reconciliation
    return new Response("OK", { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})

/*
🔒 ENHANCED PAYSTACK WEBHOOK - SECURITY HARDENED
- ✅ HMAC-SHA512 signature verification with active secret key
- ✅ Request-aware environment detection (LIVE/TEST)
- ✅ No IP-based authentication bypass
- ✅ Idempotent transaction and order updates
- ✅ Proper amount conversion (kobo → naira)
- ✅ Comprehensive logging and audit trail
- ✅ Graceful error handling with 200 responses
*/

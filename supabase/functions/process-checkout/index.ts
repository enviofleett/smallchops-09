import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Types
interface OrderItem {
  product_id: string; // can be uuid or bundle id string
  product_name?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  discount_amount?: number;
  customization_items?: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface CheckoutBody {
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address?: Record<string, unknown> | null;
  pickup_point_id?: string | null;
  order_items: OrderItem[];
  total_amount: number; // NGN
  delivery_fee?: number | null;
  delivery_zone_id?: string | null;
  payment_method: 'paystack';
  guest_session_id?: string | null;
  payment_reference?: string | null;
  currency?: string | null; // default NGN
}

// Reusable CORS helper
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://oknnklksdiqaifhxaccs.lovable.app',
    'https://preview--smallchops-09.lovable.app',
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) allowedOrigins.push(`https://${customDomain}`);

  const isDev = Deno.env.get('DENO_ENV') === 'development';
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin! : (isDev ? '*' : allowedOrigins[0]),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    'Content-Type': 'application/json'
  };
}

// Simple HTTP error with status
class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// Strict validation and normalization
export function validateCheckoutPayload(body: any): CheckoutBody {
  if (!body || typeof body !== 'object') throw new HttpError('Invalid JSON payload', 400);

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const required = ['customer_email','customer_name','fulfillment_type','order_items','total_amount','payment_method'];
  for (const k of required) if (body[k] === undefined || body[k] === null) throw new HttpError(`Missing required field: ${k}`, 422);

  const customer_email = String(body.customer_email).trim().toLowerCase();
  if (!emailRegex.test(customer_email)) throw new HttpError('Invalid customer_email', 422);

  const customer_name = String(body.customer_name).trim();
  if (customer_name.length < 2) throw new HttpError('customer_name too short', 422);

  const payment_method = String(body.payment_method).toLowerCase();
  if (payment_method !== 'paystack') throw new HttpError('Unsupported payment_method', 422);

  const fulfillment_type = String(body.fulfillment_type) as CheckoutBody['fulfillment_type'];
  if (!['delivery','pickup'].includes(fulfillment_type)) throw new HttpError('fulfillment_type must be "delivery" or "pickup"', 422);

  const order_items = Array.isArray(body.order_items) ? body.order_items : [];
  if (order_items.length === 0) throw new HttpError('order_items must contain at least one item', 422);

  // Validate items
  order_items.forEach((it: any, idx: number) => {
    if (!it) throw new HttpError(`order_items[${idx}] is invalid`, 422);
    if (it.product_id === undefined) throw new HttpError(`order_items[${idx}].product_id is required`, 422);
    if (typeof it.quantity !== 'number' || it.quantity <= 0) throw new HttpError(`order_items[${idx}].quantity must be > 0`, 422);
    const unit = typeof it.unit_price === 'number' ? it.unit_price : typeof it.price === 'number' ? it.price : NaN;
    if (!Number.isFinite(unit) || unit <= 0) throw new HttpError(`order_items[${idx}].unit_price invalid`, 422);
  });

  const total_amount = Number(body.total_amount);
  if (!Number.isFinite(total_amount) || total_amount <= 0) throw new HttpError('total_amount must be > 0', 422);

  const currency = (body.currency ?? 'NGN').toString().toUpperCase();
  if (!['NGN'].includes(currency)) throw new HttpError('Unsupported currency. Only NGN is supported', 422);

  const delivery_address = body.delivery_address ?? null;
  const pickup_point_id = body.pickup_point_id ?? null;

  if (fulfillment_type === 'delivery' && !delivery_address) throw new HttpError('delivery_address is required for delivery orders', 422);
  if (fulfillment_type === 'pickup' && !pickup_point_id) throw new HttpError('pickup_point_id is required for pickup orders', 422);
  if (pickup_point_id && typeof pickup_point_id === 'string' && !uuidRegex.test(pickup_point_id)) {
    throw new HttpError('pickup_point_id must be a valid UUID', 422);
  }

  // Normalize items
  const normalizedItems: OrderItem[] = order_items.map((it: any) => ({
    product_id: String(it.product_id),
    product_name: it.product_name,
    quantity: Number(it.quantity),
    unit_price: typeof it.unit_price === 'number' ? it.unit_price : it.price,
    discount_amount: typeof it.discount_amount === 'number' ? it.discount_amount : 0,
    customization_items: it.customization_items
  }));

  const guest_session_id = typeof body.guest_session_id === 'string' && body.guest_session_id.trim().length > 0
    ? body.guest_session_id.trim() : null;

  const customer_phone = body.customer_phone ? String(body.customer_phone) : undefined;

  const delivery_fee = body.delivery_fee === null || body.delivery_fee === undefined
    ? null : Number(body.delivery_fee);

  const delivery_zone_id = body.delivery_zone_id ?? null;

  const payment_reference = body.payment_reference ? String(body.payment_reference) : null;

  return {
    customer_email,
    customer_name,
    customer_phone,
    fulfillment_type,
    delivery_address,
    pickup_point_id,
    order_items: normalizedItems,
    total_amount,
    delivery_fee,
    delivery_zone_id,
    payment_method: 'paystack',
    guest_session_id,
    payment_reference,
    currency
  };
}

// Upsert transaction idempotently by provider_reference
export async function upsertTransaction(
  supabase: SupabaseClient,
  payload: { order_id: string; provider_reference: string; amount: number; metadata?: Record<string, unknown>; status?: string }
) {
  const toInsert = {
    order_id: payload.order_id,
    provider_reference: payload.provider_reference,
    amount: payload.amount,
    status: payload.status ?? 'pending',
    metadata: payload.metadata ?? {}
  } as any;

  // Use upsert on provider_reference uniqueness
  const { data, error } = await (supabase
    .from('payment_transactions')
    .upsert(toInsert, { onConflict: 'provider_reference' })
    .select('*')
    .single());

  if (error) {
    // If unique violation bubbles differently, treat as success (idempotent)
    if (String(error.message).toLowerCase().includes('duplicate') ||
        String(error.details || '').toLowerCase().includes('already exists') ) {
      return { idempotent: true, data: null };
    }
    throw error;
  }
  return { idempotent: false, data };
}

// Paystack initialization via internal edge function
async function initializePayment(
  supabase: SupabaseClient,
  args: { email: string; amountKobo: number; reference: string; callback_url: string; metadata: Record<string, unknown> }
) {
  const { data: response, error } = await supabase.functions.invoke('paystack-secure', {
    body: {
      action: 'initialize',
      email: args.email,
      amount: args.amountKobo,
      reference: args.reference,
      callback_url: args.callback_url,
      metadata: args.metadata
    }
  });
  if (error) throw new HttpError(`Payment init failed: ${error.message}`, 502);

  // Normalize and extract authorization_url
  let resp: any = response;
  if (typeof resp === 'string') { try { resp = JSON.parse(resp); } catch (_) {} }
  if (resp?.data && typeof resp.data === 'string') { try { resp.data = JSON.parse(resp.data); } catch (_) {} }
  if (!resp?.status) throw new HttpError(`Payment provider returned failure`, 502);

  const inner = resp?.data ?? resp;
  const authorization_url = inner?.authorization_url ?? inner?.data?.authorization_url;
  const access_code = inner?.access_code ?? inner?.data?.access_code ?? null;
  const reference = inner?.reference ?? args.reference;

  if (!authorization_url) throw new HttpError('Missing authorization_url from payment provider', 502);

  // Validate URL
  try { new URL(authorization_url); } catch { throw new HttpError('Invalid authorization_url from payment provider', 502); }

  return { authorization_url, access_code, reference };
}

export async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin');
  const cors = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), { status: 405, headers: cors });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const raw = await req.json().catch(() => ({}));
    const body = validateCheckoutPayload(raw);

    // Auth context (optional)
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        authenticatedUserId = user?.id ?? null;
      } catch (_) {}
    }

    // Enforce allow_guest_checkout setting
    const { data: settingsRow } = await supabaseAdmin
      .from('business_settings')
      .select('allow_guest_checkout')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsRow?.allow_guest_checkout === false && !authenticatedUserId) {
      throw new HttpError('Guest checkout is disabled. Please sign in to continue.', 403);
    }

    // Ensure customer account exists (by email)
    let customerId: string | null = null;
    {
      const { data: existing } = await supabaseAdmin
        .from('customer_accounts')
        .select('id')
        .eq('email', body.customer_email)
        .maybeSingle();

      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('customer_accounts')
          .insert({
            name: body.customer_name,
            email: body.customer_email,
            phone: body.customer_phone ?? null,
            user_id: authenticatedUserId,
            email_verified: !!authenticatedUserId,
            phone_verified: false
          })
          .select('id')
          .single();
        if (createErr) throw new HttpError('Failed to create customer account', 500);
        customerId = created.id;
      }
    }

    // Prepare items for RPC (support custom bundles)
    const processedItems = body.order_items.map((item) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.product_id);
      const out: any = {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price ?? item.price,
        discount_amount: item.discount_amount ?? 0
      };
      if (!isUuid) {
        out.customization_items = item.customization_items && Array.isArray(item.customization_items)
          ? item.customization_items
          : [{ id: '00000000-0000-0000-0000-000000000000', name: item.product_name ?? 'Bundle', price: item.unit_price ?? item.price, quantity: item.quantity }];
      }
      return out;
    });

    // Create order via RPC
    const { data: orderId, error: orderErr } = await supabaseAdmin.rpc('create_order_with_items', {
      p_customer_id: customerId,
      p_fulfillment_type: body.fulfillment_type,
      p_delivery_address: body.fulfillment_type === 'delivery' ? body.delivery_address : null,
      p_pickup_point_id: body.fulfillment_type === 'pickup' ? body.pickup_point_id : null,
      p_delivery_zone_id: body.delivery_zone_id ?? null,
      p_guest_session_id: body.guest_session_id ?? null,
      p_items: processedItems
    });
    if (orderErr || !orderId) throw new HttpError(`Failed to create order: ${orderErr?.message ?? 'unknown'}`, 500);

    // Retrieve order for number
    const { data: order } = await supabaseAdmin.from('orders').select('order_number').eq('id', orderId).single();

    // Determine payment reference (idempotent if provided)
    const reference = body.payment_reference || `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Persist reference on the order early
    await supabaseAdmin.from('orders').update({ payment_reference: reference, updated_at: new Date().toISOString() }).eq('id', orderId);

    // Initialize payment with retry (duplicate reference-safe inside the paystack-secure function)
    const maxRetries = 2;
    let authUrl: string | null = null;
    let accessCode: string | null = null;
    let lastErr: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const init = await initializePayment(supabaseAdmin, {
          email: body.customer_email,
          amountKobo: Math.round(body.total_amount * 100),
          reference,
          callback_url: `${origin || 'https://startersmallchops.com'}/payment/callback?order_id=${orderId}`,
          metadata: {
            order_id: orderId,
            order_number: order?.order_number,
            customer_name: body.customer_name,
            fulfillment_type: body.fulfillment_type
          }
        });
        authUrl = init.authorization_url;
        accessCode = init.access_code;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt === maxRetries) throw e;
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }

    // Idempotent transaction creation
    try {
      await upsertTransaction(supabaseAdmin, {
        order_id: orderId,
        provider_reference: reference,
        amount: body.total_amount,
        status: 'pending',
        metadata: { customer_id: customerId, order_number: order?.order_number, user_id: authenticatedUserId }
      });
    } catch (e) {
      // Do not fail the whole flow if a duplicate/upsert issue occurs
      console.warn('payment_transactions upsert warning:', e);
    }

    const response = {
      success: true,
      order_id: orderId,
      order_number: order?.order_number,
      total_amount: body.total_amount,
      payment: {
        payment_url: authUrl,
        authorization_url: authUrl,
        reference,
        access_code: accessCode
      },
      message: 'Order created and payment initialized successfully'
    };

    return new Response(JSON.stringify(response), { status: 200, headers: cors });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Checkout process failed';
    return new Response(JSON.stringify({ success: false, error: message }), { status, headers: cors });
  }
}

// Only start the server when executed by Deno Deploy/Edge runtime
if (import.meta.main) {
  serve(handler);
}

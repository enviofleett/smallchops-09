import { assertEquals, assertThrows } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { validateCheckoutPayload, upsertTransaction } from "./index.ts";

Deno.test('validateCheckoutPayload - rejects missing fields', () => {
  assertThrows(
    () => validateCheckoutPayload({}),
    Error,
    'Missing required field'
  );
});

Deno.test('validateCheckoutPayload - rejects invalid email', () => {
  assertThrows(
    () => validateCheckoutPayload({
      customer_email: 'bad',
      customer_name: 'User',
      fulfillment_type: 'pickup',
      order_items: [{ product_id: crypto.randomUUID(), quantity: 1, unit_price: 1000 }],
      total_amount: 1000,
      payment_method: 'paystack',
      pickup_point_id: crypto.randomUUID()
    }),
    Error,
    'Invalid customer_email'
  );
});

Deno.test('validateCheckoutPayload - rejects invalid items', () => {
  assertThrows(
    () => validateCheckoutPayload({
      customer_email: 'user@example.com',
      customer_name: 'User',
      fulfillment_type: 'pickup',
      order_items: [{ product_id: crypto.randomUUID(), quantity: 0, unit_price: 1000 }],
      total_amount: 1000,
      payment_method: 'paystack',
      pickup_point_id: crypto.randomUUID()
    }),
    Error,
    'quantity must be > 0'
  );
});

Deno.test('validateCheckoutPayload - accepts valid payload', () => {
  const payload = validateCheckoutPayload({
    customer_email: 'user@example.com',
    customer_name: 'ToolBux',
    customer_phone: '+2348050000000',
    fulfillment_type: 'pickup',
    pickup_point_id: crypto.randomUUID(),
    order_items: [{ product_id: crypto.randomUUID(), quantity: 1, unit_price: 5000 }],
    total_amount: 5000,
    payment_method: 'paystack'
  });
  assertEquals(payload.customer_email, 'user@example.com');
  assertEquals(payload.fulfillment_type, 'pickup');
  assertEquals(payload.order_items.length, 1);
});

Deno.test('upsertTransaction - handles success and duplicate gracefully', async () => {
  // Minimal mock of Supabase client chain
  const mockSupabase: any = {
    from: () => ({
      upsert: (_: any, __: any) => ({
        select: () => ({
          single: async () => ({ data: { id: 'tx1' }, error: null })
        })
      })
    })
  };
  const ok = await upsertTransaction(mockSupabase, {
    order_id: crypto.randomUUID(),
    provider_reference: 'ref-1',
    amount: 1000
  });
  assertEquals(ok.idempotent, false);

  const dupSupabase: any = {
    from: () => ({
      upsert: (_: any, __: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: { message: 'duplicate key value violates unique constraint' } })
        })
      })
    })
  };
  const dup = await upsertTransaction(dupSupabase, {
    order_id: crypto.randomUUID(),
    provider_reference: 'ref-1',
    amount: 1000
  });
  assertEquals(dup.idempotent, true);
});

import { handler } from "./index.ts";
import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

// This test is skipped by default. Enable by setting RUN_INTEGRATION_TESTS=true
const RUN = Deno.env.get('RUN_INTEGRATION_TESTS') === 'true';

(RUN ? Deno.test : Deno.test.ignore)('process-checkout integration smoke', async () => {
  const body = {
    customer_email: 'integration@example.com',
    customer_name: 'Integration Test',
    fulfillment_type: 'pickup',
    pickup_point_id: '00000000-0000-0000-0000-000000000001',
    order_items: [{ product_id: '4fc5ebee-e0eb-4901-9f54-1bd2fc94f881', quantity: 1, unit_price: 1000 }],
    total_amount: 1000,
    payment_method: 'paystack'
  };

  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  const res = await handler(req);
  assertEquals(res.status, 200);
  const json = await res.json();
  assert(json.success === true);
  assert(json.payment?.authorization_url);
});

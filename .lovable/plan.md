

# Admin Create Order for Customers

## Overview

Build an "Admin Create Order" feature that reuses the exact storefront checkout experience, then generates a **Paystack Dedicated Virtual Account (DVA)** for the customer to pay via bank transfer, and emails the order details + virtual account info. Admins can also download a PDF of the created order.

## How It Works (End-to-End Flow)

```text
Admin clicks "Create Order" on /admin/orders
        |
        v
Full-screen dialog opens with the SAME checkout UI
(product selection from catalog, delivery scheduler,
 fulfillment type, customer info, order summary)
        |
        v
Admin submits -> Edge function creates order
with payment_status = "pending" and payment_method = "bank_transfer"
        |
        v
Edge function calls Paystack "Create Dedicated Virtual Account"
API to generate a temporary NUBAN for this customer
        |
        v
System sends email to customer with:
  - Full order details (items, totals, delivery schedule)
  - Virtual account number, bank name, account name
  - Payment instructions and expiry info
        |
        v
Admin sees confirmation with option to download PDF
(PDF includes order details + virtual account info)
        |
        v
When customer pays via bank transfer, Paystack webhook
(already exists) confirms payment and updates order status
```

## Technical Implementation

### 1. New Edge Function: `admin-create-order`

**File:** `supabase/functions/admin-create-order/index.ts`

- Requires admin authentication (same pattern as `admin-orders-manager`)
- Accepts the same payload structure as `process-checkout` but with an additional `created_by_admin: true` flag
- Creates order in DB with `payment_method: 'bank_transfer'`, `payment_status: 'pending'`
- Calls Paystack Dedicated Virtual Account API:
  ```
  POST https://api.paystack.co/dedicated_account
  Body: { customer: <customer_id_or_code>, preferred_bank: "wema-bank" }
  ```
- First creates/fetches the Paystack customer using `POST https://api.paystack.co/customer` with the customer's email, name, and phone
- Stores the virtual account details (account_number, bank_name, account_name) in a new `order_payment_accounts` table
- Queues an email via `communication_events` with template `admin_order_invoice` containing order details + payment account info
- Returns order + virtual account details to the admin UI

### 2. New Database Table: `order_payment_accounts`

Stores temporary virtual account details for admin-created orders:

```sql
CREATE TABLE public.order_payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id)
);

ALTER TABLE public.order_payment_accounts ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage payment accounts"
  ON public.order_payment_accounts FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()));

-- Service role access for webhooks
CREATE POLICY "Service role full access"
  ON public.order_payment_accounts FOR ALL
  TO service_role
  USING (true);
```

### 3. New Email Template: `admin_order_invoice`

Seed into `enhanced_email_templates` table:

- Subject: "Order {{order_number}} - Payment Required"
- Body includes: order items table, totals, delivery schedule, virtual account details (account number, bank name, account name), payment instructions, expiry notice

### 4. New Admin UI Component: `AdminCreateOrderDialog`

**File:** `src/components/admin/AdminCreateOrderDialog.tsx`

This is a full-screen dialog that reuses the EXACT storefront components:

- **Product Selection Step**: Fetch products from the catalog, let admin add items to a temporary cart with quantities (reuse existing product cards/list)
- **Customer Info Step**: Admin enters customer name, email, phone (or searches existing customers)
- **Fulfillment Step**: Reuses `DeliveryScheduler`, `DeliveryZoneDropdown`, `PickupPointSelector` -- identical to storefront
- **Order Summary Step**: Reuses `OrderSummaryCard` component showing items, subtotal, delivery fee, total
- **Confirmation Step**: Shows order created successfully with virtual account details and "Download PDF" button

Key reused components (100% same as storefront):
- `DeliveryScheduler` (date/time selection)
- `DeliveryZoneDropdown` (delivery zone + fee calculation)
- `PickupPointSelector` (pickup locations)
- `OrderSummaryCard` (order totals display)
- Same validation logic (`validateCheckoutForm`)
- Same fulfillment type radio group (delivery vs pickup)

### 5. Enhanced PDF: `generateAdminOrderPDF`

**File:** `src/utils/adminOrderPDF.ts`

Extends the existing `customerReceiptPDF.ts` to include:
- All existing receipt content (logo, items, totals, customer info)
- New section: "Payment Instructions" with virtual account details
- New section: "Payment Deadline" with expiry info
- "Created by Admin" watermark/badge
- Can be downloaded from both the create dialog and the order details page

### 6. Wire into Admin Orders Page

**File:** `src/pages/admin/AdminOrders.tsx`

- The existing `Plus` icon button (already imported) opens the `AdminCreateOrderDialog`
- After order creation, auto-refresh the orders list
- Add "Download Invoice PDF" action to existing order cards/details for admin-created orders

### 7. Webhook Integration (Existing)

The existing `paystack-webhook` / `paystack-webhook-secure` functions already handle `charge.success` events. When a customer pays via the virtual account (bank transfer), Paystack sends a webhook that updates the order's `payment_status` to `paid` -- no changes needed here.

## Component Reuse Summary

| Storefront Component | Reused in Admin? | Notes |
|---|---|---|
| `DeliveryScheduler` | Yes, 100% | Same date/time picker |
| `DeliveryZoneDropdown` | Yes, 100% | Same zone selection |
| `PickupPointSelector` | Yes, 100% | Same pickup points |
| `OrderSummaryCard` | Yes, 100% | Same totals display |
| `validateCheckoutForm` | Yes, 100% | Same validation rules |
| Fulfillment type radio | Yes, 100% | Same delivery/pickup choice |
| MOQ validation | Yes, 100% | Same minimum order checks |

## Files to Create/Modify

| Action | File |
|---|---|
| Create | `supabase/functions/admin-create-order/index.ts` |
| Create | `src/components/admin/AdminCreateOrderDialog.tsx` |
| Create | `src/utils/adminOrderPDF.ts` |
| Migration | New `order_payment_accounts` table |
| Seed | `admin_order_invoice` email template |
| Modify | `src/pages/admin/AdminOrders.tsx` (add create button handler) |
| Modify | `src/components/admin/EnhancedOrderCard.tsx` (add PDF download for admin orders) |

## Paystack DVA Requirements

- Uses the existing `PAYSTACK_SECRET_KEY` secret (already configured)
- Paystack DVA is available for Nigerian merchants on the Business plan
- The API creates a NUBAN (Nigerian Uniform Bank Account Number) on Wema Bank or Titan by default
- Customer must have: email (required), first_name, last_name, phone (recommended for validation)
- The virtual account persists until deactivated -- payment is matched automatically via the webhook


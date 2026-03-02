
# Fix Admin Create Order -- End-to-End for Live Production

## Root Cause Analysis

The "No products found" issue and broken submission flow have **two root causes**:

### 1. Wrong product query column names
The `AdminCreateOrderDialog` queries `.eq('is_active', true)` but the actual products table uses `.eq('status', 'active')` with `stock_quantity > 0`. The storefront edge function uses `public_products_view` (a database view) which already filters for active, in-stock products. The admin dialog should use the same approach.

### 2. Missing DialogTitle for accessibility
The dialog is missing a `DialogTitle` component, causing a console error and potential accessibility issues.

---

## Implementation Plan

### Task 1: Fix product catalog query in AdminCreateOrderDialog

**File:** `src/components/admin/AdminCreateOrderDialog.tsx`

Change the products query (lines 77-89) from:
```typescript
.from('products')
.select('id, name, price, image_url, minimum_order_quantity, stock_quantity, is_active, category_id')
.eq('is_active', true)
```

To match the storefront pattern:
```typescript
.from('products')
.select('id, name, price, image_url, minimum_order_quantity, stock_quantity, status, category_id')
.eq('status', 'active')
.gt('stock_quantity', 0)
```

This aligns with how `optimizedProducts.ts` and `get-public-products` edge function query products.

### Task 2: Fix accessibility warnings

**File:** `src/components/admin/AdminCreateOrderDialog.tsx`

- Add `DialogTitle` and `DialogDescription` from Radix inside the `DialogContent`
- Use `VisuallyHidden` wrapper since the header already provides the visual title
- Import `DialogTitle, DialogDescription` from `@/components/ui/dialog`

### Task 3: Fix OrderSummaryCard visibility in review step

The `OrderSummaryCard` component has CSS classes `hidden md:block` baked into its non-collapsible variant. The current fix uses `className="block md:block"` but the component's internal CSS may still hide it. Need to ensure the card renders on all screen sizes in the review step by passing appropriate props (not using `collapsibleOnMobile`).

Looking at the component code (from context), the desktop variant has `hidden md:block`. The admin dialog passes `className="block md:block"` which should override the `hidden`. This should work -- but I'll verify and ensure it does.

### Task 4: Edge function alignment check

The `admin-create-order` edge function already uses the correct env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) which point to the main database instance. The function logic is aligned with `process-checkout`:
- Same order data structure
- Same `order_delivery_schedule` table
- Same Lagos timezone conversion
- Correct column names (`guest_session_id`, `paystack_reference`, etc.)

No changes needed to the edge function.

### Task 5: Redeploy edge function

Redeploy `admin-create-order` to ensure the latest version is active, since logs show no previous invocations.

---

## Summary of File Changes

| File | Change |
|---|---|
| `src/components/admin/AdminCreateOrderDialog.tsx` | Fix products query (`.eq('status', 'active').gt('stock_quantity', 0)`), add `DialogTitle`/`DialogDescription` for accessibility |
| `supabase/functions/admin-create-order/index.ts` | Redeploy (no code changes needed) |

## What This Fixes
- Products will load in the catalog (currently shows "No products found")
- Dialog accessibility warnings eliminated
- Full end-to-end flow: select products, enter customer info, schedule delivery/pickup, review order, submit, get virtual account + PDF download

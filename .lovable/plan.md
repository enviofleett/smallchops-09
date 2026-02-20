

# Disable Delivery for February 20, 2026 (Pickup Only)

## What Will Change

On February 20, 2026, customers will only be able to choose **Pickup** as their fulfillment option. The **Delivery** option will be disabled and greyed out with a message explaining that delivery is unavailable on that date.

## Implementation Steps

### 1. Add a new "Delivery Disabled Dates" config to `src/config/deliveryExceptions.ts`

Add a new exported array called `DELIVERY_DISABLED_DATES` containing `'2026-02-20'` (full date format since this is a one-off, not recurring). Also add a helper function to check if a date falls on a delivery-disabled date.

```
DELIVERY_DISABLED_DATES = ['2026-02-20']
```

### 2. Update the Checkout UI in `src/components/checkout/EnhancedCheckoutFlow.tsx`

- Import the new config
- When the selected delivery date matches a delivery-disabled date, automatically switch the fulfillment type to `'pickup'` and disable the delivery radio option
- Show the delivery option as greyed out with a tooltip/message: "Delivery is not available on this date. Please select pickup."
- If no date is selected yet but the user picks delivery, and then selects Feb 20 as their date, auto-switch to pickup with a toast notification

### 3. Add backend validation in `supabase/functions/process-checkout/index.ts`

Add a check that rejects orders with `fulfillment_type: 'delivery'` when the delivery date is `2026-02-20`, returning a clear error message. This ensures the restriction is enforced server-side even if the frontend is bypassed.

## Technical Details

- The config in `deliveryExceptions.ts` uses `YYYY-MM-DD` format for one-off dates (vs `MM-DD` for recurring)
- The delivery radio button will be visually disabled (reduced opacity, no pointer events) with an informational badge
- After Feb 20 passes, the entry can simply be removed from the array
- Pickup availability and all other dates remain completely unaffected


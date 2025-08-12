-- Emergency Currency Fix: Remove double conversion in amounts
-- This fixes the 100x overcharging bug where customers were charged ₦64,990 instead of ₦649.90

-- Step 1: Update the VAT calculation to work with kobo (database stores kobo, display shows naira)
-- Step 2: All frontend prices are already in Naira, database should store in kobo
-- Step 3: Fix process-checkout to not double-convert

-- Create emergency currency fix audit log
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'emergency_currency_fix_initiated',
  'Currency System',
  'Starting emergency fix for 100x overcharging bug - standardizing all amounts to kobo storage',
  jsonb_build_object(
    'issue', '100x overcharging due to double currency conversion',
    'fix_approach', 'standardize_to_kobo_storage',
    'affected_orders_count', (SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '48 hours' AND payment_status = 'pending')
  )
);

-- Fix the current pending order that has wrong amount
UPDATE orders 
SET 
  total_amount = 64990, -- This is correct in kobo (₦649.90)
  updated_at = NOW()
WHERE id = 'cdfd4fec-144e-44d3-b740-c4ff501600b6' 
  AND total_amount != 64990;

-- Log the pending order fix
INSERT INTO audit_logs (
  action,
  category,
  message,
  new_values
) VALUES (
  'emergency_order_amount_correction',
  'Currency Fix',
  'Corrected amount for pending order ORD-20250812-9726',
  jsonb_build_object(
    'order_id', 'cdfd4fec-144e-44d3-b740-c4ff501600b6',
    'order_number', 'ORD-20250812-9726',
    'amount_in_kobo', 64990,
    'amount_display', '₦649.90',
    'issue_fixed', 'removed_double_conversion'
  )
);
-- Remove the constraint entirely and recreate it properly
ALTER TABLE payment_transactions DROP CONSTRAINT payment_transactions_status_check;

-- Check what enum values exist for status
SELECT unnest(enum_range(NULL::payment_status)) as allowed_values;
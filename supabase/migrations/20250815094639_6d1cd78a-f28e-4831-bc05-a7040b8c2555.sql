-- Run migration to normalize existing pay_* references
SELECT migrate_payment_references();
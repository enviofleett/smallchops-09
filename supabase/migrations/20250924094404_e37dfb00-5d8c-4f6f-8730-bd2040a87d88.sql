-- Phase 1A: Enable RLS on critical payment tables (minimal approach)

-- Enable RLS on the most critical tables first
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- ENUMS
CREATE TYPE promotion_type AS ENUM ('discount', 'loyalty', 'referral', 'bundle', 'flash_sale');
CREATE TYPE promotion_status AS ENUM ('active', 'paused', 'expired');
CREATE TYPE loyalty_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
CREATE TYPE points_transaction_type AS ENUM ('earn', 'redeem', 'adjustment');

-- PROMOTIONS TABLE
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type promotion_type NOT NULL,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  min_purchase NUMERIC,
  loyalty_points_reward INTEGER,
  referral_reward_amount NUMERIC,
  tier_required loyalty_tier,
  usage_limit INTEGER,
  per_customer_limit INTEGER,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  status promotion_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- PROMOTION USAGE LOG: track which customer redeems what
CREATE TABLE public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  customer_id UUID,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  order_id UUID
);

-- CUSTOMER LOYALTY STATE
CREATE TABLE public.customer_loyalty (
  customer_id UUID PRIMARY KEY,
  points_balance INTEGER DEFAULT 0,
  current_tier loyalty_tier DEFAULT 'bronze',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- POINTS TRANSACTION LOG
CREATE TABLE public.points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customer_loyalty(customer_id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type points_transaction_type NOT NULL,
  related_order_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  description TEXT
);

-- REFERRALS
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_customer_id UUID NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reward_granted BOOLEAN DEFAULT FALSE,
  UNIQUE (referrer_id, referred_customer_id)
);

-- RLS POLICIES
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Example user-level policies, assuming customer_id maps to profiles.id or auth
CREATE POLICY "Customer can view their loyalty info"
  ON customer_loyalty FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Customer can view their points transactions"
  ON points_transactions FOR SELECT
  USING (customer_id = auth.uid());

CREATE POLICY "Allow all read for promotions"
  ON promotions FOR SELECT
  USING (true);

-- Add policies for inserting/updating promotion_usage only for the logged-in user
CREATE POLICY "Customer can insert their own usage"
  ON promotion_usage FOR INSERT
  WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Customer can view their promo usage"
  ON promotion_usage FOR SELECT
  USING (customer_id = auth.uid());

-- Referral: Only referrer or referred can read their referral record
CREATE POLICY "Can view own referral"
  ON referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_customer_id = auth.uid());

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER update_customer_loyalty_updated_at
  BEFORE UPDATE ON customer_loyalty
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

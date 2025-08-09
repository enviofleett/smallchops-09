
-- 1) Ensure provider_reference is unique so upserts can target it
ALTER TABLE public.payment_transactions
ADD CONSTRAINT payment_transactions_provider_reference_key UNIQUE (provider_reference);

-- 2) Make writes resilient by defaulting the required transaction_type to 'charge'
ALTER TABLE public.payment_transactions
ALTER COLUMN transaction_type SET DEFAULT 'charge';

-- 3) Align analytics: treat both 'paid' and 'success' as successful transactions
CREATE OR REPLACE FUNCTION public.update_transaction_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Calculate analytics for the date of the new/updated transaction
  WITH daily_stats AS (
    SELECT 
      DATE(created_at) as transaction_date,
      COUNT(*) as total_transactions,
      COUNT(*) FILTER (WHERE status IN ('success', 'paid')) as successful_transactions,
      COUNT(*) FILTER (WHERE status NOT IN ('success', 'paid')) as failed_transactions,
      COALESCE(SUM(amount) FILTER (WHERE status IN ('success', 'paid')), 0) as total_amount,
      COALESCE(SUM(fees) FILTER (WHERE status IN ('success', 'paid')), 0) as total_fees,
      COALESCE(AVG(amount) FILTER (WHERE status IN ('success', 'paid')), 0) as average_transaction_value
    FROM payment_transactions 
    WHERE DATE(created_at) = DATE(NEW.created_at)
    GROUP BY DATE(created_at)
  ),
  channel_stats AS (
    SELECT 
      jsonb_object_agg(
        COALESCE(channel, 'unknown'), 
        channel_count
      ) as channels_used
    FROM (
      SELECT 
        COALESCE(channel, 'unknown') as channel,
        COUNT(*) as channel_count
      FROM payment_transactions 
      WHERE DATE(created_at) = DATE(NEW.created_at)
      GROUP BY COALESCE(channel, 'unknown')
    ) channel_counts
  )
  INSERT INTO transaction_analytics (
    date,
    total_transactions,
    successful_transactions,
    failed_transactions,
    total_amount,
    total_fees,
    channels_used,
    average_transaction_value,
    success_rate
  )
  SELECT 
    ds.transaction_date,
    ds.total_transactions,
    ds.successful_transactions,
    ds.failed_transactions,
    ds.total_amount,
    ds.total_fees,
    COALESCE(cs.channels_used, '{}'::jsonb),
    ds.average_transaction_value,
    CASE 
      WHEN ds.total_transactions > 0 THEN 
        ROUND((ds.successful_transactions::DECIMAL / ds.total_transactions) * 100, 2)
      ELSE 0 
    END as success_rate
  FROM daily_stats ds
  CROSS JOIN channel_stats cs
  ON CONFLICT (date) DO UPDATE SET
    total_transactions = EXCLUDED.total_transactions,
    successful_transactions = EXCLUDED.successful_transactions,
    failed_transactions = EXCLUDED.failed_transactions,
    total_amount = EXCLUDED.total_amount,
    total_fees = EXCLUDED.total_fees,
    channels_used = EXCLUDED.channels_used,
    average_transaction_value = EXCLUDED.average_transaction_value,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

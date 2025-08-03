-- Function to backfill customer accounts for existing users
CREATE OR REPLACE FUNCTION public.create_missing_customer_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_record record;
  v_customer_account_id uuid;
  v_result jsonb;
BEGIN
  -- Get user details from auth.users
  SELECT id, email, raw_user_meta_data, email_confirmed_at, created_at
  INTO v_user_record
  FROM auth.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Create customer account if it doesn't exist
  INSERT INTO public.customer_accounts (
    user_id,
    name,
    phone,
    email_verified,
    phone_verified,
    profile_completion_percentage,
    created_at,
    updated_at
  ) VALUES (
    v_user_record.id,
    COALESCE(
      v_user_record.raw_user_meta_data->>'name',
      v_user_record.raw_user_meta_data->>'full_name',
      split_part(v_user_record.email, '@', 1)
    ),
    v_user_record.raw_user_meta_data->>'phone',
    v_user_record.email_confirmed_at IS NOT NULL,
    false,
    CASE 
      WHEN v_user_record.raw_user_meta_data->>'phone' IS NOT NULL THEN 80 
      ELSE 60 
    END,
    v_user_record.created_at,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email_verified = EXCLUDED.email_verified,
    profile_completion_percentage = EXCLUDED.profile_completion_percentage,
    updated_at = NOW()
  RETURNING id INTO v_customer_account_id;

  -- Also ensure customers table entry exists
  INSERT INTO public.customers (
    user_id,
    name,
    email,
    phone,
    created_at,
    updated_at
  ) VALUES (
    v_user_record.id,
    COALESCE(
      v_user_record.raw_user_meta_data->>'name',
      v_user_record.raw_user_meta_data->>'full_name',
      split_part(v_user_record.email, '@', 1)
    ),
    v_user_record.email,
    v_user_record.raw_user_meta_data->>'phone',
    v_user_record.created_at,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    updated_at = NOW()
  WHERE customers.user_id IS NULL;

  v_result := jsonb_build_object(
    'success', true,
    'customer_account_id', v_customer_account_id,
    'user_id', p_user_id
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
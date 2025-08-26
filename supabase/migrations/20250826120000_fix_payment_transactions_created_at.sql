-- Fix: Ensure payment_transactions table has created_at column
-- This migration addresses delivery management page errors when loading order details

-- First, check if payment_transactions table exists and add created_at if missing
DO $$
BEGIN
    -- Check if payment_transactions table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_transactions'
    ) THEN
        -- Check if created_at column exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'payment_transactions' 
            AND column_name = 'created_at'
        ) THEN
            -- Add created_at column if it doesn't exist
            ALTER TABLE public.payment_transactions 
            ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
            
            -- Create index for performance
            CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at 
            ON public.payment_transactions(created_at);
            
            RAISE NOTICE 'Added created_at column to payment_transactions table';
        ELSE
            RAISE NOTICE 'created_at column already exists in payment_transactions table';
        END IF;
    ELSE
        -- If payment_transactions table doesn't exist, create it with proper schema
        CREATE TABLE public.payment_transactions (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
            provider_reference text UNIQUE,
            amount numeric NOT NULL DEFAULT 0,
            currency text NOT NULL DEFAULT 'NGN',
            status text NOT NULL DEFAULT 'pending',
            fees numeric,
            channel text,
            customer_email text,
            provider_response jsonb,
            paid_at timestamptz,
            processed_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );

        -- Create indexes for performance
        CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions(order_id);
        CREATE INDEX idx_payment_transactions_created_at ON public.payment_transactions(created_at);
        CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
        CREATE INDEX idx_payment_transactions_customer_email ON public.payment_transactions(LOWER(customer_email));

        -- Enable RLS
        ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

        -- Create RLS policies
        CREATE POLICY "Admins can view payment_transactions"
            ON public.payment_transactions
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'admin'
                )
            );

        CREATE POLICY "Service role can manage payment_transactions"
            ON public.payment_transactions
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');

        -- Create updated_at trigger
        CREATE TRIGGER trg_payment_transactions_updated_at
            BEFORE UPDATE ON public.payment_transactions
            FOR EACH ROW
            EXECUTE FUNCTION public.set_current_timestamp_updated_at();

        RAISE NOTICE 'Created payment_transactions table with created_at column';
    END IF;
END $$;
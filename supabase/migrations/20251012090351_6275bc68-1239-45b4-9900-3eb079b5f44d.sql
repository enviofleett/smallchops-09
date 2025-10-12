-- Drop existing policies first
DROP POLICY IF EXISTS "System can insert order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admins can view order status history" ON public.order_status_history;

-- Create order_status_history table to track all status changes
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at ON public.order_status_history(changed_at DESC);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all history
CREATE POLICY "Admins can view order status history"
  ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (is_admin());

-- RLS Policy: System can insert history records
CREATE POLICY "System can insert order status history"
  ON public.order_status_history
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- Create function to automatically log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (
      order_id,
      old_status,
      new_status,
      changed_by,
      changed_at
    ) VALUES (
      NEW.id,
      OLD.status::TEXT,
      NEW.status::TEXT,
      NEW.updated_by,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on orders table to automatically log status changes
DROP TRIGGER IF EXISTS trigger_log_order_status_change ON public.orders;
CREATE TRIGGER trigger_log_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();
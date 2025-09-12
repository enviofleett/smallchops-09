-- Phase 1: Emergency Email System Fixes
-- Add deduplication and source tracking columns
ALTER TABLE public.communication_events 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown';

-- Create communication event warnings table
CREATE TABLE IF NOT EXISTS public.communication_event_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID,
  event_type TEXT,
  attempted_recipient_email TEXT,
  error_reason TEXT NOT NULL,
  original_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT
);

-- Enable RLS on warnings table
ALTER TABLE public.communication_event_warnings ENABLE ROW LEVEL SECURITY;

-- Create policy for warnings table
CREATE POLICY "Admins can manage communication event warnings"
ON public.communication_event_warnings
FOR ALL USING (is_admin())
WITH CHECK (is_admin());

-- Create function to generate dedupe key
CREATE OR REPLACE FUNCTION public.generate_dedupe_key(
  p_order_id UUID,
  p_event_type TEXT,
  p_template_key TEXT,
  p_recipient_email TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN CONCAT(
    COALESCE(p_order_id::text, 'no-order'), 
    '|',
    COALESCE(p_event_type, 'no-event'),
    '|', 
    COALESCE(p_template_key, 'no-template'),
    '|',
    COALESCE(LOWER(TRIM(p_recipient_email)), 'no-email')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create auto-fix trigger function
CREATE OR REPLACE FUNCTION public.auto_fix_communication_events()
RETURNS TRIGGER AS $$
DECLARE
  v_order_email TEXT;
  v_dedupe_key TEXT;
  v_existing_count INTEGER;
BEGIN
  -- Generate dedupe key
  NEW.dedupe_key := public.generate_dedupe_key(
    NEW.order_id,
    NEW.event_type,
    NEW.template_key,
    NEW.recipient_email
  );
  
  -- Check for duplicates
  SELECT COUNT(*) INTO v_existing_count
  FROM public.communication_events
  WHERE dedupe_key = NEW.dedupe_key
    AND created_at > NOW() - INTERVAL '1 hour'; -- Only check recent duplicates
  
  IF v_existing_count > 0 THEN
    -- Log duplicate attempt and skip insertion
    INSERT INTO public.communication_event_warnings (
      order_id,
      event_type,
      attempted_recipient_email,
      error_reason,
      original_payload
    ) VALUES (
      NEW.order_id,
      NEW.event_type,
      NEW.recipient_email,
      'Duplicate event blocked - dedupe_key: ' || NEW.dedupe_key,
      jsonb_build_object(
        'template_key', NEW.template_key,
        'variables', NEW.variables,
        'source', NEW.source
      )
    );
    
    -- Log audit event
    INSERT INTO public.audit_logs (
      action,
      category,
      message,
      entity_id,
      new_values
    ) VALUES (
      'communication_event_duplicate_blocked',
      'Email System',
      'Blocked duplicate communication event with dedupe_key: ' || NEW.dedupe_key,
      NEW.order_id,
      jsonb_build_object(
        'dedupe_key', NEW.dedupe_key,
        'event_type', NEW.event_type,
        'source', NEW.source
      )
    );
    
    RETURN NULL; -- Skip insertion
  END IF;
  
  -- Fix missing recipient email
  IF NEW.recipient_email IS NULL OR TRIM(NEW.recipient_email) = '' THEN
    -- Try to get email from related order
    IF NEW.order_id IS NOT NULL THEN
      SELECT customer_email INTO v_order_email
      FROM public.orders
      WHERE id = NEW.order_id;
      
      IF v_order_email IS NOT NULL AND TRIM(v_order_email) != '' THEN
        NEW.recipient_email := v_order_email;
        
        -- Log the fix
        INSERT INTO public.audit_logs (
          action,
          category,
          message,
          entity_id,
          new_values
        ) VALUES (
          'communication_event_email_auto_fixed',
          'Email System',
          'Auto-fixed missing recipient_email from order.customer_email',
          NEW.order_id,
          jsonb_build_object(
            'fixed_email', v_order_email,
            'event_type', NEW.event_type,
            'source', NEW.source
          )
        );
      ELSE
        -- Cannot fix - log warning and block
        INSERT INTO public.communication_event_warnings (
          order_id,
          event_type,
          attempted_recipient_email,
          error_reason,
          original_payload
        ) VALUES (
          NEW.order_id,
          NEW.event_type,
          NEW.recipient_email,
          'Missing recipient_email and no valid customer_email in related order',
          jsonb_build_object(
            'template_key', NEW.template_key,
            'variables', NEW.variables,
            'source', NEW.source,
            'order_customer_email', v_order_email
          )
        );
        
        RETURN NULL; -- Block insertion
      END IF;
    ELSE
      -- No order_id - log warning and block
      INSERT INTO public.communication_event_warnings (
        order_id,
        event_type,
        attempted_recipient_email,
        error_reason,
        original_payload
      ) VALUES (
        NEW.order_id,
        NEW.event_type,
        NEW.recipient_email,
        'Missing recipient_email and no order_id to lookup customer_email',
        jsonb_build_object(
          'template_key', NEW.template_key,
          'variables', NEW.variables,
          'source', NEW.source
        )
      );
      
      RETURN NULL; -- Block insertion
    END IF;
  END IF;
  
  -- Set source if not provided
  IF NEW.source IS NULL OR NEW.source = 'unknown' THEN
    NEW.source := 'auto_trigger';
  END IF;
  
  -- Update dedupe key with fixed email
  NEW.dedupe_key := public.generate_dedupe_key(
    NEW.order_id,
    NEW.event_type,
    NEW.template_key,
    NEW.recipient_email
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_fix_communication_events_trigger ON public.communication_events;
CREATE TRIGGER auto_fix_communication_events_trigger
  BEFORE INSERT ON public.communication_events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_fix_communication_events();

-- Create unique index for deduplication (allowing nulls for existing data)
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_dedupe_key
ON public.communication_events (dedupe_key)
WHERE dedupe_key IS NOT NULL;

-- Update existing communication events to set source for tracking
UPDATE public.communication_events 
SET source = 'legacy_trigger'
WHERE source IS NULL OR source = 'unknown';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_communication_events_source ON public.communication_events (source);
CREATE INDEX IF NOT EXISTS idx_communication_events_created_at_source ON public.communication_events (created_at, source);

-- Update the existing validation trigger to work with new auto-fix trigger
DROP TRIGGER IF EXISTS validate_communication_event_trigger ON public.communication_events;
-- The auto-fix trigger now handles all validation
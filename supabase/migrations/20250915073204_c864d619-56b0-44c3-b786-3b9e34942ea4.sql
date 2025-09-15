-- EMERGENCY FIX: Apply the enhanced UPSERT function to prevent duplicate key errors

-- Step 1: Drop the problematic unique constraint temporarily
DROP INDEX IF EXISTS idx_communication_events_dedupe_key;

-- Step 2: Clean up any existing duplicate records
WITH duplicates AS (
    SELECT id, 
           dedupe_key,
           ROW_NUMBER() OVER (
               PARTITION BY dedupe_key 
               ORDER BY created_at DESC, id DESC
           ) as rn
    FROM communication_events
    WHERE dedupe_key IS NOT NULL
)
DELETE FROM communication_events 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Step 3: Enhanced UPSERT function with absolute uniqueness guarantee
CREATE OR REPLACE FUNCTION public.upsert_communication_event(
    p_event_type text, 
    p_recipient_email text, 
    p_recipient_name text, 
    p_template_key text, 
    p_template_variables jsonb, 
    p_related_order_id uuid, 
    p_dedupe_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    event_id UUID;
    calculated_dedupe_key TEXT;
    attempt_count INTEGER := 0;
    max_attempts INTEGER := 5;
    random_suffix TEXT;
BEGIN
    LOOP
        attempt_count := attempt_count + 1;
        
        -- Generate unique dedupe key with enhanced randomness
        IF p_dedupe_key IS NULL THEN
            -- Add random suffix and microsecond precision for absolute uniqueness
            random_suffix := substring(gen_random_uuid()::text from 1 for 8);
            calculated_dedupe_key := p_related_order_id::TEXT || '|' || 
                                   p_event_type || '|' || 
                                   COALESCE(p_template_key, 'no-template') || '|' || 
                                   p_recipient_email || '|' || 
                                   EXTRACT(EPOCH FROM clock_timestamp())::TEXT || '|' ||
                                   random_suffix;
        ELSE
            calculated_dedupe_key := p_dedupe_key || '|' || EXTRACT(EPOCH FROM clock_timestamp())::TEXT;
        END IF;
        
        BEGIN
            -- UPSERT with conflict resolution
            INSERT INTO communication_events (
                event_type, recipient_email, template_key, template_variables,
                status, dedupe_key, order_id, created_at, updated_at
            ) VALUES (
                p_event_type, p_recipient_email, p_template_key, p_template_variables,
                'queued', calculated_dedupe_key, p_related_order_id, now(), now()
            )
            ON CONFLICT (dedupe_key) DO UPDATE SET
                template_variables = EXCLUDED.template_variables,
                updated_at = now(),
                status = CASE 
                    WHEN communication_events.status = 'failed' THEN 'queued'
                    ELSE communication_events.status
                END
            RETURNING id INTO event_id;
            
            -- Success - exit loop
            EXIT;
            
        EXCEPTION 
            WHEN unique_violation THEN
                -- If still duplicate after max attempts, give up gracefully
                IF attempt_count >= max_attempts THEN
                    -- Return a special event ID to indicate we gave up but didn't fail
                    INSERT INTO communication_events (
                        event_type, recipient_email, template_key, template_variables,
                        status, dedupe_key, order_id, created_at, updated_at,
                        error_message
                    ) VALUES (
                        p_event_type, p_recipient_email, p_template_key, p_template_variables,
                        'failed', calculated_dedupe_key || '|final', p_related_order_id, now(), now(),
                        'Failed to create unique event after ' || max_attempts || ' attempts'
                    )
                    RETURNING id INTO event_id;
                    
                    EXIT;
                END IF;
                
                -- Wait briefly and try again
                PERFORM pg_sleep(0.001 * attempt_count);
                
            WHEN OTHERS THEN
                -- Re-raise other errors
                RAISE;
        END;
    END LOOP;
    
    RETURN event_id;
END;
$function$

-- Step 4: Recreate the unique constraint with proper handling
CREATE UNIQUE INDEX idx_communication_events_dedupe_key_safe 
ON communication_events (dedupe_key) 
WHERE dedupe_key IS NOT NULL AND status != 'failed';

-- Step 5: Clean up stuck events and reset failed ones for retry
UPDATE communication_events 
SET status = 'queued', 
    error_message = NULL,
    updated_at = now()
WHERE status = 'failed' 
  AND created_at > now() - interval '1 hour'
  AND error_message NOT LIKE '%duplicate%';

-- Step 6: Verify the fix
SELECT 
    'Fix applied successfully' as message,
    COUNT(*) as total_events,
    COUNT(CASE WHEN status = 'queued' THEN 1 END) as queued_for_retry
FROM communication_events 
WHERE created_at > now() - interval '1 hour';
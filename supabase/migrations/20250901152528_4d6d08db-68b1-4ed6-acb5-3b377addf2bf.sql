-- Clean up email system: Remove legacy functions and hardcoded credentials
-- This migration removes references to legacy email functions and cleans up hardcoded credentials

-- Remove any triggers that might reference legacy email functions
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Check for triggers that might call legacy email functions
    FOR trigger_record IN
        SELECT schemaname, tablename, triggername 
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_triggerdef(t.oid) ILIKE ANY (ARRAY[
            '%smtp-email-sender%',
            '%email-queue-processor%'
        ])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
            trigger_record.triggername,
            trigger_record.schemaname,
            trigger_record.tablename);
        
        RAISE NOTICE 'Dropped legacy email trigger: %.% on %.%',
            trigger_record.schemaname,
            trigger_record.triggername,
            trigger_record.schemaname,
            trigger_record.tablename;
    END LOOP;
END $$;

-- Clean up any communication_settings records with hardcoded credentials
-- Only remove completely hardcoded entries, preserve user configurations
UPDATE communication_settings 
SET 
  smtp_host = CASE 
    WHEN smtp_host = 'mail.startersmallchops.com' THEN '' 
    ELSE smtp_host 
  END,
  smtp_user = CASE 
    WHEN smtp_user = 'store@startersmallchops.com' THEN '' 
    ELSE smtp_user 
  END,
  sender_email = CASE 
    WHEN sender_email = 'store@startersmallchops.com' THEN '' 
    ELSE sender_email 
  END,
  smtp_pass = '',  -- Always clear passwords for security
  updated_at = NOW()
WHERE 
  smtp_host = 'mail.startersmallchops.com' 
  OR smtp_user = 'store@startersmallchops.com' 
  OR sender_email = 'store@startersmallchops.com';

-- Update any database functions that might reference legacy functions
-- Note: This is informational - manual review may be needed
DO $$
DECLARE 
    func_record RECORD;
BEGIN
    -- Find functions that might reference legacy email functions
    FOR func_record IN
        SELECT n.nspname, p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) ILIKE ANY (ARRAY[
            '%smtp-email-sender%',
            '%email-queue-processor%'
        ])
    LOOP
        RAISE NOTICE 'Function %.% may contain references to legacy email functions - manual review recommended',
            func_record.nspname,
            func_record.proname;
    END LOOP;
END $$;

-- Log the cleanup
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'email_system_cleanup',
  'System Maintenance',
  'Completed email system cleanup: removed legacy function references and hardcoded credentials',
  jsonb_build_object(
    'unified_functions', jsonb_build_array('unified-smtp-sender', 'unified-email-queue-processor'),
    'removed_legacy', jsonb_build_array('smtp-email-sender', 'email-queue-processor'),
    'credential_cleanup', 'Removed hardcoded SMTP credentials',
    'cleanup_date', NOW(),
    'status', 'completed'
  )
);
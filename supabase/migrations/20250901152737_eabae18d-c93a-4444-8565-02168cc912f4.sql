-- Clean up email system: Remove legacy functions and hardcoded credentials (Fixed)
-- This migration removes references to legacy email functions and cleans up hardcoded credentials

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

-- Remove any legacy triggers that might reference old email functions
DO $$
DECLARE
    trigger_record RECORD;
    trigger_def TEXT;
BEGIN
    -- Check for triggers that might call legacy email functions
    FOR trigger_record IN
        SELECT n.nspname as schema_name, c.relname as table_name, t.tgname as trigger_name, t.oid
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND NOT t.tgisinternal
    LOOP
        trigger_def := pg_get_triggerdef(trigger_record.oid);
        
        IF trigger_def ILIKE '%smtp-email-sender%' 
           OR trigger_def ILIKE '%email-queue-processor%' THEN
            
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I',
                trigger_record.trigger_name,
                trigger_record.schema_name,
                trigger_record.table_name);
            
            RAISE NOTICE 'Dropped legacy email trigger: % on %.%',
                trigger_record.trigger_name,
                trigger_record.schema_name,
                trigger_record.table_name;
        END IF;
    END LOOP;
END $$;

-- Log the cleanup
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'email_system_cleanup_fixed',
  'System Maintenance',
  'Completed email system cleanup: removed legacy function references and hardcoded credentials',
  jsonb_build_object(
    'unified_functions', jsonb_build_array('unified-smtp-sender', 'unified-email-queue-processor'),
    'removed_legacy', jsonb_build_array('smtp-email-sender', 'email-queue-processor'),
    'credential_cleanup', 'Removed hardcoded SMTP credentials from communication_settings',
    'cleanup_date', NOW(),
    'status', 'completed'
  )
);
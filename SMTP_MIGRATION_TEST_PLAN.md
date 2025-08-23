# SMTP System Hardening Migration Test Plan

## Migration File: 20250823140729_ee967801-0352-4ca9-bedd-0d5efb94ec84.sql

### Requirements Covered:

#### Tables:
- [x] **smtp_provider_configs** - Updates existing table with required columns (provider_name, status, suspended_until, credentials, last_checked)
- [x] **smtp_connection_audit** - Updates existing table with required columns (provider_name, connection_attempt_at, ip_address, result, updated_at)  
- [x] **smtp_delivery_confirmations** - Updates existing table with required columns (provider_name, message_id, status)
- [x] **rate_limit_counters** - Creates new table with required structure

#### Indexes:
- [x] **communication_events indexes** - Adds composite index for status/priority/retry/scheduled and individual indexes for recipient_email and template_key
- [x] **smtp_connection_audit indexes** - Adds index on provider_name and connection_attempt_at
- [x] **smtp_delivery_confirmations indexes** - Adds index on recipient_email and created_at

#### Triggers:
- [x] **Validation trigger** - Creates enforce_communication_event_validity() function and trigger for communication_events to validate recipient_email format and ensure template_key/event_type are present

#### pg_cron Jobs:
- [x] **Job scheduling** - Provides commented examples for:
  - process_email_queue (every minute)
  - monitor_smtp_health (every 5 minutes)  
  - monitor_email_production (every 5 minutes)
  - snapshot_email_health (daily at midnight)

### Database Schema Assumptions:

1. **communication_events table exists** with these columns:
   - recipient_email (added in migration 20250728090106)
   - template_key (added in migration 20250816062206)
   - priority (added in migration 20250816104442)
   - scheduled_at (added in migration 20250816104442)
   - status, event_type, last_error (from original table)

2. **SMTP-related tables exist** but may need schema updates:
   - smtp_provider_configs (created in 20250804074405)
   - smtp_connection_audit (created in 20250804074405)
   - smtp_delivery_confirmations (created in 20250804080433)

3. **pg_cron extension** is available (enabled in 20250809153545)

### Migration Safety Features:

- Uses `IF NOT EXISTS` checks for all schema modifications
- Uses `DO $$` blocks to conditionally add columns only if they don't exist
- Preserves existing data and structures
- Adds proper RLS policies for new tables
- Includes comprehensive comments for documentation

### Testing Commands:

```sql
-- Check that tables exist with required columns
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('smtp_provider_configs', 'smtp_connection_audit', 'smtp_delivery_confirmations', 'rate_limit_counters')
ORDER BY table_name, ordinal_position;

-- Check that indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename IN ('communication_events', 'smtp_connection_audit', 'smtp_delivery_confirmations')
AND indexname LIKE 'idx_%';

-- Check that trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'validate_communication_event';

-- Test trigger function
INSERT INTO communication_events (event_type, recipient_email, template_key) 
VALUES ('test', 'invalid-email', 'test_template');
-- Should set status to 'failed' and last_error to 'Invalid recipient_email'
```

### Production Deployment Notes:

1. Run migration during low-traffic period
2. Configure pg_cron jobs after migration with actual URLs and service keys
3. Monitor SMTP provider health scores and connection audit logs
4. Set up alerts for rate limit violations and delivery failures
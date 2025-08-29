# Unified SMTP System On-Call Runbook

## Health Dashboards
- Dashboard: [Email Production Monitor](https://startersmallchops.com/admin/email-monitor)
- Edge Function Logs: Supabase Dashboard > Edge Functions > Logs
- Database Monitoring: communication_events, smtp_health_metrics tables

## Current System Architecture
- **unified-smtp-sender**: Core SMTP sending functionality
- **enhanced-email-processor**: Queue management and batch processing
- **email-core**: API interface for external email requests
- **email-production-monitor**: Health monitoring and alerting

## Troubleshooting Steps

### 1. Email Not Sending
```sql
-- Check communication events for errors
SELECT id, recipient_email, status, error_message, retry_count, created_at 
FROM communication_events 
WHERE status IN ('failed', 'processing') 
ORDER BY created_at DESC LIMIT 10;
```

**Common fixes:**
1. Check SMTP credentials in communication_settings
2. Verify unified-smtp-sender function is deployed
3. Check rate limits: `SELECT * FROM rate_limit_counters;`
4. Restart enhanced-email-processor: Invoke function manually

### 2. High Queue Backlog
```sql
-- Check queue size
SELECT COUNT(*) as queued_count FROM communication_events WHERE status = 'queued';
```

**Actions:**
1. Trigger enhanced-email-processor manually
2. Check for failed function deployments
3. Increase batch size temporarily via admin panel

### 3. SMTP Authentication Failures
- Verify credentials in communication_settings table
- Check if email provider changed authentication requirements
- Test with unified-smtp-sender health check function

## Batch Size Adjustment
- Update batch size in enhanced-email-processor via database:
  ```sql
  -- Update email processing configuration
  UPDATE enhanced_email_configs 
  SET batch_size = 250 
  WHERE config_key = 'default_batch_size';
  ```
- Or trigger with custom batch size:
  ```typescript
  await supabase.functions.invoke('enhanced-email-processor', {
    body: { batch_size: 100 }
  });
  ```

## Critical Procedures

### Emergency Queue Processing
```bash
# 1. Check function health
curl -X POST https://[project].supabase.co/functions/v1/enhanced-email-processor \
  -H "Authorization: Bearer [service_key]" \
  -H "Content-Type: application/json" \
  -d '{"health_check": true}'

# 2. Force process all queued emails
curl -X POST https://[project].supabase.co/functions/v1/enhanced-email-processor \
  -H "Authorization: Bearer [service_key]" \
  -H "Content-Type: application/json" \
  -d '{"force_process": true}'
```

### Legacy Function Check
**Ensure these functions are NO LONGER CALLED:**
- ❌ instant-email-processor (removed)
- ❌ native-smtp-sender (removed)  
- ❌ smtp-email-sender (replaced)
- ❌ process-communication-events (replaced)

**If found, update to use:**
- ✅ unified-smtp-sender
- ✅ enhanced-email-processor

## Error Logging
- All errors log masked config and troubleshooting guidance for on-call.
- Reference provider_response and error_message columns for clues.

## Contacts & Escalation
- [On-call Slack channel](https://your.slack.com/channel/oncall)
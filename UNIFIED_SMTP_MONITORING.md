# Unified SMTP System Monitoring Guide

## Key Metrics to Monitor

### 1. Email Queue Health
```sql
-- Monitor queue size and processing rate
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/60) as avg_age_minutes
FROM communication_events 
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status;
```

### 2. SMTP Connection Health
```sql
-- Check SMTP provider status
SELECT 
  provider_name,
  health_score,
  last_checked,
  is_active
FROM smtp_provider_configs
ORDER BY last_checked DESC;
```

### 3. Rate Limiting Status
```sql
-- Monitor rate limiting activity
SELECT 
  identifier,
  request_count,
  window_start,
  reputation_score
FROM rate_limit_counters
WHERE window_start > NOW() - INTERVAL '1 hour'
ORDER BY request_count DESC;
```

### 4. Error Analysis
```sql
-- Analyze recent failures
SELECT 
  error_message,
  COUNT(*) as error_count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM communication_events
WHERE status = 'failed' 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY error_count DESC;
```

## Automated Monitoring Scripts

### Daily Health Check
```bash
#!/bin/bash
# Add to cron: 0 8 * * * /path/to/smtp_health_check.sh

SUPABASE_URL="your_url"
SERVICE_KEY="your_key"

# Check queue backlog
QUEUE_SIZE=$(curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/get_queue_size" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" | jq '.result')

if [ "$QUEUE_SIZE" -gt 100 ]; then
  echo "⚠️ High queue backlog: $QUEUE_SIZE emails"
  # Trigger enhanced processor
  curl -X POST "$SUPABASE_URL/functions/v1/enhanced-email-processor" \
    -H "Authorization: Bearer $SERVICE_KEY"
fi
```

### Real-time Alerting
```typescript
// Add to email-production-monitor function
export async function checkUnifiedSMTPHealth(supabase: any) {
  const issues = [];
  
  // Check queue size
  const { data: queueSize } = await supabase
    .rpc('get_queue_size');
    
  if (queueSize > 50) {
    issues.push(`High queue backlog: ${queueSize} emails`);
  }
  
  // Check recent failures
  const { data: recentFailures } = await supabase
    .from('communication_events')
    .select('count')
    .eq('status', 'failed')
    .gte('created_at', new Date(Date.now() - 3600000).toISOString());
    
  if (recentFailures?.[0]?.count > 10) {
    issues.push(`High failure rate: ${recentFailures[0].count} failures in last hour`);
  }
  
  // Check SMTP health
  const { data: smtpHealth } = await supabase
    .from('smtp_provider_configs')
    .select('health_score')
    .eq('is_active', true)
    .single();
    
  if (smtpHealth?.health_score < 0.8) {
    issues.push(`SMTP provider health degraded: ${smtpHealth.health_score}`);
  }
  
  return issues;
}
```

## Dashboard Queries for Admin Panel

### Email Volume Trends
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE status = 'sent') as sent_emails,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_emails,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'sent')::numeric / 
    NULLIF(COUNT(*), 0) * 100, 2
  ) as success_rate
FROM communication_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

### Template Performance
```sql
SELECT 
  template_key,
  COUNT(*) as total_sent,
  COUNT(*) FILTER (WHERE status = 'sent') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_send_time_seconds
FROM communication_events
WHERE created_at > NOW() - INTERVAL '7 days'
  AND template_key IS NOT NULL
GROUP BY template_key
ORDER BY total_sent DESC;
```

### Rate Limiting Effectiveness
```sql
SELECT 
  DATE_TRUNC('day', window_start) as day,
  COUNT(DISTINCT identifier) as unique_senders,
  SUM(request_count) as total_requests,
  AVG(reputation_score) as avg_reputation
FROM rate_limit_counters
WHERE window_start > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', window_start)
ORDER BY day DESC;
```

## Performance Benchmarks

### Target Metrics
- **Queue Processing**: < 5 minutes average age
- **Success Rate**: > 95% for last 24 hours  
- **SMTP Health**: > 0.9 health score
- **Rate Limit Violations**: < 1% of requests

### Performance Optimization
1. **Batch Size Tuning**: Adjust based on provider limits
2. **Retry Logic**: Exponential backoff with circuit breaker
3. **Connection Pooling**: Reuse SMTP connections when possible
4. **Template Caching**: Cache processed templates

## Alert Thresholds
- 🔴 **Critical**: Queue > 100 emails, Success rate < 90%
- 🟡 **Warning**: Queue > 50 emails, Success rate < 95%
- 🟢 **Healthy**: Queue < 20 emails, Success rate > 95%
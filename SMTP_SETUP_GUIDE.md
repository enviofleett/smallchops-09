# Unified SMTP Email System Setup Guide

## 🎯 Environment Variables Required

Set these in your Supabase Dashboard > Settings > Edge Functions:

```bash
# CRITICAL: Set your production domain
ALLOWED_ORIGINS="https://startersmallchops.com,https://www.startersmallchops.com"

# Environment mode
DENO_ENV="production"
```

## ✅ What Was Implemented

1. **Unified SMTP System**: Single `unified-smtp-sender` function handles all email sending
2. **Enhanced Email Processing**: `enhanced-email-processor` manages the email queue efficiently  
3. **Consolidated Event Processing**: All email types routed through streamlined processors
4. **Rate Limiting**: Built-in email rate limiting (10/hour, 50/day per recipient)
5. **Standardized Logging**: Unified `communication_events` table for all email tracking
6. **Template Support**: Full template processing with variable replacement
7. **Production CORS**: Environment-aware CORS configuration
8. **Error Handling**: Comprehensive error logging and retry mechanisms

## 🔄 Migration Complete

**Legacy Components Removed:**
- ❌ `native-smtp-sender` (replaced by unified-smtp-sender)
- ❌ `instant-email-processor` (consolidated into enhanced-email-processor)
- ❌ `process-communication-events` (replaced by enhanced version)
- ❌ All `smtp-email-sender` references (updated to unified-smtp-sender)

**Current Architecture:**
- ✅ `unified-smtp-sender` - Core SMTP sending functionality
- ✅ `enhanced-email-processor` - Queue management and processing
- ✅ `email-core` - API interface for sending emails
- ✅ Automated cron jobs for background processing

## 🚀 Production Setup Steps

1. **Configure SMTP Settings**:
   - Go to Settings > Communications Tab > SMTP Settings
   - Host: `mail.startersmallchops.com`
   - Port: `587`
   - Username: Your SMTP username
   - Password: Your SMTP password
   - Enable "Use Secure Connection (TLS/SSL)"

2. **Test Email System**:
   - Click "Test SMTP Connection" in the Communications tab
   - Check your email for the test message
   - Monitor the Edge Function logs for any issues

3. **Set Environment Variables**:
   ```bash
   ALLOWED_ORIGINS="https://startersmallchops.com"
   DENO_ENV="production"
   ```

## 📊 Email Delivery Monitoring

- **Delivery Logs**: Available in `communication_events` table with full event tracking
- **Rate Limiting**: Automatic protection against spam/abuse via `enhanced-email-rate-limiter`
- **Health Metrics**: Track delivery success rates through `smtp_health_metrics`
- **Template Management**: Manage email templates through the admin interface
- **Queue Management**: Real-time queue monitoring via `enhanced-email-processor`

## 🔧 Troubleshooting

### Common Issues:

1. **CORS Errors in Production**:
   - Ensure `ALLOWED_ORIGINS` includes your exact domain
   - Check for trailing slashes in URLs

2. **SMTP Authentication Failures**:
   - Verify credentials in `communication_settings` table
   - Check if your email provider requires app-specific passwords
   - Ensure port 587 is accessible

3. **Email Not Sending**:
   - Check `communication_events` table for status
   - Review logs in `enhanced-email-processor` function
   - Verify `unified-smtp-sender` is functioning

4. **Template Not Found**:
   - Verify template exists and is active
   - Check template key matches function calls

5. **Rate Limiting**:
   - Review rate limits in `enhanced-email-rate-limiter`
   - Check `rate_limit_counters` table for current usage

## 🔐 Security Features

- **Search Path Protection**: All database functions use `SET search_path = 'public'`
- **Row Level Security**: Proper RLS policies on all email-related tables
- **Rate Limiting**: Built-in protection against email abuse
- **Input Validation**: Comprehensive validation of email addresses and content
- **Error Logging**: Secure logging without exposing sensitive data

## 📋 Production Checklist

- [ ] `ALLOWED_ORIGINS` set to production domain(s)
- [ ] `DENO_ENV` set to "production"
- [ ] SMTP credentials configured and tested
- [ ] Email templates created and tested
- [ ] Rate limits configured appropriately
- [ ] Error monitoring set up
- [ ] Delivery tracking verified
- [ ] Legacy functions removed (see migration section above)
- [ ] All processors updated to use unified system

## 🧪 End-to-End Testing

### 1. Test SMTP Connection
```bash
# In Admin Panel -> Communications -> Test SMTP
# This now uses unified-smtp-sender
```

### 2. Test Email Flow
```typescript
// Test order confirmation email
const { data, error } = await supabase.functions.invoke('email-core', {
  body: {
    action: 'send_email',
    recipient: 'test@example.com',
    subject: 'Test Order Confirmation',
    templateKey: 'order_confirmation',
    variables: {
      customer_name: 'Test Customer',
      order_number: 'TEST-001',
      order_total: '₦25.00'
    }
  }
});
```

### 3. Monitor Processing
```sql
-- Check communication events
SELECT * FROM communication_events 
WHERE recipient_email = 'test@example.com' 
ORDER BY created_at DESC;

-- Check rate limiting
SELECT * FROM rate_limit_counters 
WHERE identifier LIKE '%test@example.com%';
```

### 4. Test Major Email Types
- [ ] Order confirmation emails
- [ ] Payment confirmation emails  
- [ ] Welcome emails
- [ ] Password reset emails
- [ ] Admin notifications
- [ ] Delivery tracking updates

## 🚨 Security Recommendations

1. **Enable Leaked Password Protection**: Go to Supabase Dashboard > Authentication > Settings
2. **Review RLS Policies**: Ensure all email tables have proper access controls
3. **Monitor Email Logs**: Regularly check for suspicious activity
4. **Backup Templates**: Keep backups of your email templates
5. **Test Regularly**: Set up automated testing of email functionality

## 📞 Support

If you encounter issues:
1. Check the Edge Function logs in Supabase Dashboard
2. Review the `email_delivery_logs` table for delivery status
3. Verify SMTP settings are correct
4. Test with a simple email first before using templates
# Email System Refactoring to SMTP-Only

## Overview

This document outlines the complete refactoring of the email system to remove all third-party email service integrations (MailerSend, SendGrid, etc.) and consolidate all email sending through a single SMTP provider.

## What Changed

### ✅ Email Queue Processor
- **File**: `supabase/functions/email-queue-processor/index.ts`
- **Change**: Updated `selectEmailSender()` function to always return `smtp-email-sender`
- **Impact**: All emails (high/normal/low priority, transactional/marketing) now use unified SMTP sender

### ✅ Admin UI Components
- **File**: `src/components/admin/EmailQueueProcessor.tsx` 
- **Change**: Removed buttons for `production-email-processor`, `enhanced-email-processor`, `instant-email-processor`
- **Impact**: Admin panel now only shows SMTP queue processing options

### ✅ Email Automation Hook
- **File**: `src/hooks/useEmailAutomation.ts`
- **Change**: Updated all email triggers to use `smtp-email-sender` and `email-queue-processor`
- **Impact**: Welcome emails, order confirmations, etc. all sent via SMTP

### ✅ SMTP Settings Configuration
- **File**: `src/components/settings/SMTPSettingsTab.tsx`
- **Change**: Removed SendGrid and Mailgun from provider options, added YouNotify SMTP
- **Impact**: Users can only configure legitimate SMTP providers

### ✅ Environment Configuration
- **File**: `.env.example`
- **Change**: Added comprehensive SMTP configuration examples
- **Impact**: Clear guidance for SMTP setup with YouNotify and other providers

## Migration Steps

### 1. Pre-Migration Checklist

- [ ] Backup current email queue data
- [ ] Verify SMTP settings are configured and tested
- [ ] Ensure YouNotify SMTP credentials are ready
- [ ] Test SMTP connection in admin panel

### 2. Run Database Migration

Execute the email queue purge migration:

```sql
-- Run this in your Supabase SQL editor
\i supabase/sql/purge-email-queue.sql
```

This will:
- Archive all queued/processing emails 
- Delete queued/processing emails from active queue
- Log migration details for audit trail
- Reset sequences for clean start

### 3. Configure YouNotify SMTP

In the admin panel (Settings > Communications):

1. **SMTP Host**: `smtp.yournotify.com`
2. **SMTP Port**: `587` (recommended) or `465` for SSL
3. **Security**: Enable TLS/SSL
4. **Username**: Your YouNotify SMTP username
5. **Password**: Your YouNotify SMTP password
6. **Sender Email**: Your verified domain email
7. **Sender Name**: Your business name

### 4. Test Email System

After configuration:

1. Use "Test SMTP Connection" in admin panel
2. Send test emails for each email type:
   - Welcome emails (new user registration)
   - Order confirmations (place test order)
   - Password reset emails
   - Admin notifications

### 5. Monitor Email Delivery

Check these areas for successful migration:

- **Admin Panel**: Email Queue Processor shows healthy status
- **Database**: `communication_events` table only shows 'sent' or 'failed' statuses
- **Logs**: `email_delivery_logs` table shows 'smtp' as provider for all new emails

## Testing Instructions

### Unit Testing

Test individual email functions:

```javascript
// Test SMTP sender directly
const result = await supabase.functions.invoke('smtp-email-sender', {
  body: {
    templateId: 'customer_welcome',
    recipient: { email: 'test@example.com', name: 'Test User' },
    variables: { customer_name: 'Test User' }
  }
});
```

### Integration Testing

1. **Welcome Email Flow**:
   - Register new customer account
   - Verify welcome email received via SMTP
   - Check email delivery logs

2. **Order Confirmation Flow**:
   - Place test order
   - Verify order confirmation email
   - Verify admin notification email

3. **Queue Processing**:
   - Add emails to queue manually
   - Run queue processor from admin panel
   - Verify all emails sent via SMTP

### Performance Testing

Monitor these metrics after migration:

- Email delivery success rate (should be >95%)
- Queue processing time
- SMTP connection reliability
- Email delivery speed

## Troubleshooting

### Common Issues

**1. SMTP Authentication Failures**
- Verify YouNotify credentials are correct
- Check if account has SMTP access enabled
- Test with alternative SMTP provider (Gmail with App Password)

**2. Queue Processing Stuck**
- Check SMTP server connectivity
- Verify port 587 is accessible
- Review error logs in admin panel

**3. Emails Not Sending**
- Confirm SMTP settings are enabled (`use_smtp: true`)
- Check sender email is verified with provider
- Review communication_events table for error messages

### Rollback Procedure

If issues occur, you can temporarily rollback:

1. **Restore archived emails** (if needed):
```sql
INSERT INTO communication_events (
  recipient_email, template_key, template_variables, 
  priority, status, created_at
)
SELECT 
  recipient_email, template_key, variables,
  priority, 'queued', NOW()
FROM email_archive 
WHERE archive_reason = 'Purged during SMTP-only migration';
```

2. **Revert code changes** using git:
```bash
git revert <commit-hash>
```

## Security Considerations

- SMTP credentials are stored securely in Supabase database
- All SMTP connections use TLS/SSL encryption
- YouNotify SMTP provides dedicated IP and reputation management
- Email sending rate limits prevent abuse

## Performance Optimizations

- Single SMTP connection reduces complexity
- Connection pooling in `smtp-email-sender` function
- Retry logic for failed deliveries
- Queue processing optimized for SMTP delivery patterns

## Monitoring and Alerts

Set up monitoring for:

- Email delivery success rates
- Queue processing health
- SMTP connection failures  
- Bounce/complaint handling

## Support

For issues related to:

- **SMTP Configuration**: Check YouNotify documentation
- **Code Issues**: Review this migration guide and test procedures
- **Database Issues**: Check migration logs and error tables
- **Performance**: Monitor email delivery metrics and optimize as needed

---

**Migration Completed**: 📧 ✅ All email sending now unified through SMTP-only system
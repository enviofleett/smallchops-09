# Production Email System Setup Guide

## 🎯 Environment Variables Required

Set these in your Supabase Dashboard > Settings > Edge Functions:

```bash
# CRITICAL: Set your production domain
ALLOWED_ORIGINS="https://startersmallchops.com,https://www.startersmallchops.com"

# Environment mode
DENO_ENV="production"
```

## ✅ What Was Implemented

1. **Consolidated Email System**: Single `production-email-processor` function handles all email sending
2. **Enhanced Security**: Fixed 11+ database functions with proper search paths and security policies
3. **Rate Limiting**: Built-in email rate limiting (10/hour, 50/day per recipient)
4. **Standardized Logging**: Unified `email_delivery_logs` table for all email tracking
5. **Template Support**: Full template processing with variable replacement
6. **Production CORS**: Environment-aware CORS configuration
7. **Error Handling**: Comprehensive error logging and retry mechanisms

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

- **Delivery Logs**: Available in the Admin panel under Email Analytics
- **Rate Limiting**: Automatic protection against spam/abuse
- **Health Metrics**: Track delivery success rates and performance
- **Template Management**: Manage email templates through the admin interface

## 🔧 Troubleshooting

### Common Issues:

1. **CORS Errors in Production**:
   - Ensure `ALLOWED_ORIGINS` includes your exact domain
   - Check for trailing slashes in URLs

2. **SMTP Authentication Failures**:
   - Verify credentials are correct
   - Check if your email provider requires app-specific passwords
   - Ensure port 587 is accessible

3. **Template Not Found**:
   - Verify template exists in `enhanced_email_templates` table
   - Check template is marked as `is_active = true`

4. **Rate Limiting**:
   - Review rate limits in `check_email_rate_limit` function
   - Adjust limits if needed for your use case

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
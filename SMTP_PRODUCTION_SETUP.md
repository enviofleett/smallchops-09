# SMTP Production Setup Guide

## Overview
This guide will help you configure SMTP credentials for production email delivery. The system supports both Function Secrets (recommended for production) and database configuration (for development/testing).

## 🔐 Security First: Use Function Secrets for Production

### Step 1: Configure Function Secrets in Supabase Dashboard

Navigate to: **Project Settings → Edge Functions → Environment Variables**

Add these required secrets:

```
Variable Name: SMTP_HOST
Value: your-smtp-server.com

Variable Name: SMTP_PORT
Value: 587

Variable Name: SMTP_USER
Value: your-email@domain.com (or API key for services like SendGrid)

Variable Name: SMTP_PASS
Value: your-app-password-or-api-key

Variable Name: SMTP_SECURE
Value: false (use false for port 587 with STARTTLS, true for port 465 with SSL)

Variable Name: SENDER_EMAIL
Value: noreply@yourdomain.com

Variable Name: SENDER_NAME
Value: Your Business Name
```

## 📧 Provider-Specific Configuration

### Gmail Configuration
```
SMTP_HOST: smtp.gmail.com
SMTP_PORT: 587
SMTP_USER: your-gmail@gmail.com
SMTP_PASS: your-app-password (NOT your regular password)
SMTP_SECURE: false
```

**Important for Gmail:**
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Go to Google Account → Security → App passwords
3. Use the generated 16-character app password as SMTP_PASS

### Outlook/Hotmail Configuration
```
SMTP_HOST: smtp-mail.outlook.com
SMTP_PORT: 587
SMTP_USER: your-email@outlook.com
SMTP_PASS: your-outlook-password
SMTP_SECURE: false
```

### SendGrid Configuration
```
SMTP_HOST: smtp.sendgrid.net
SMTP_PORT: 587
SMTP_USER: apikey (literally the word "apikey")
SMTP_PASS: your-sendgrid-api-key
SMTP_SECURE: false
```

### AWS SES Configuration
```
SMTP_HOST: email-smtp.us-east-1.amazonaws.com
SMTP_PORT: 587
SMTP_USER: your-ses-smtp-username
SMTP_PASS: your-ses-smtp-password
SMTP_SECURE: false
```

### Mailgun Configuration
```
SMTP_HOST: smtp.mailgun.org
SMTP_PORT: 587
SMTP_USER: postmaster@your-domain.mailgun.org
SMTP_PASS: your-mailgun-smtp-password
SMTP_SECURE: false
```

## 🧪 Testing Your Configuration

### Step 2: Test SMTP Connection

1. Go to your application's Settings page
2. Navigate to the "Communication Settings" section
3. Click the "Test Connection" button
4. You should see a success message confirming SMTP authentication

### Step 3: Verify Email Templates

Test different email types to ensure templates work correctly:
- Welcome emails
- Order confirmations
- Status updates
- Password resets

## 🔍 Production Health Monitoring

### Step 4: Monitor Email Health

Use the Production Overview dashboard to monitor:
- SMTP connection status
- Email delivery rates
- Failed delivery alerts
- Rate limiting status

### Health Check Endpoint
Your system includes automatic health checks that verify:
- SMTP server connectivity
- Authentication validity
- Template availability
- Rate limit compliance

## 🚨 Troubleshooting Common Issues

### Authentication Failed
- **Gmail**: Ensure you're using an App Password, not your regular password
- **Outlook**: Check if your account has 2FA enabled
- **SendGrid**: Verify your API key has mail sending permissions
- **AWS SES**: Confirm your SMTP credentials are for the correct region

### Connection Timeout
- Verify SMTP_HOST and SMTP_PORT are correct
- Check if your hosting provider blocks outbound SMTP ports
- Ensure firewall rules allow SMTP traffic

### TLS/SSL Issues
- For port 587: Use SMTP_SECURE=false (STARTTLS)
- For port 465: Use SMTP_SECURE=true (SSL/TLS)
- Never use port 25 for production

### Rate Limiting
- The system has built-in rate limiting (10 emails per hour per recipient)
- Monitor the rate limit dashboard
- Consider upgrading your email provider plan for higher limits

## 📋 Production Checklist

### Before Going Live:

- [ ] SMTP credentials configured in Function Secrets (not database)
- [ ] Test connection successful
- [ ] Email templates customized for your brand
- [ ] Sender domain configured and verified with your email provider
- [ ] SPF, DKIM, and DMARC records configured for your domain
- [ ] Rate limits appropriate for your expected volume
- [ ] Monitoring alerts configured
- [ ] Backup email provider configured (optional but recommended)

### Domain Authentication Setup:

1. **SPF Record**: Add to your DNS
   ```
   v=spf1 include:_spf.google.com ~all (for Gmail)
   v=spf1 include:sendgrid.net ~all (for SendGrid)
   ```

2. **DKIM**: Configure through your email provider's dashboard

3. **DMARC**: Add to your DNS
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

## 🔧 Environment Variables Reference

### Required Environment Variables (Supabase Function Secrets):
```bash
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USER=username-or-email
SMTP_PASS=password-or-api-key
SMTP_SECURE=false
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Business Name
```

### Optional Environment Variables:
```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
DENO_ENV=production
```

## 📞 Support

If you encounter issues:

1. Check the Edge Function logs in Supabase Dashboard
2. Verify your email provider's documentation
3. Test with a simple email client first
4. Check your domain's DNS configuration
5. Review the system's audit logs for detailed error messages

## 🚀 Going Live

Once everything is configured and tested:

1. Update your `DENO_ENV` to `production`
2. Remove any test email addresses from your configuration
3. Monitor the first few emails closely
4. Set up alerting for failed deliveries
5. Document your configuration for your team

---

**Remember**: Never store SMTP credentials in your codebase or database for production. Always use Supabase Function Secrets for sensitive configuration data.
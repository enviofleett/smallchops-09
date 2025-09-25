# Production Function Secrets Setup Guide

## 🔐 Critical: Configure Function Secrets for Production

### Step 1: Access Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs)
2. Navigate to: **Settings → Edge Functions → Environment Variables**
3. Click "Add new variable" for each secret below

### Step 2: Configure Required Secrets

#### Core SMTP Configuration
```bash
# Variable Name: SMTP_HOST
# Value: smtp.gmail.com (or your provider's SMTP server)

# Variable Name: SMTP_PORT  
# Value: 587 (or 465 for SSL)

# Variable Name: SMTP_USER
# Value: your-business-email@gmail.com

# Variable Name: SMTP_PASS
# Value: your-app-password (16 characters for Gmail)
```

#### Email Branding
```bash
# Variable Name: SENDER_EMAIL
# Value: noreply@yourbusiness.com

# Variable Name: SENDER_NAME
# Value: Your Business Name
```

#### Production Mode
```bash
# Variable Name: EMAIL_PRODUCTION_MODE
# Value: true

# Variable Name: DENO_ENV
# Value: production
```

#### Security & CORS (Optional but Recommended)
```bash
# Variable Name: ALLOWED_ORIGINS
# Value: https://yourdomain.com,https://app.yourdomain.com
```

### Step 3: Provider-Specific Configuration

#### Option A: Gmail (Easiest for Small Business)
**Prerequisites:**
1. Enable 2-Factor Authentication on Google account
2. Generate App Password: Google Account → Security → App passwords
3. Select "Mail" and generate 16-character password

**Configuration:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop (16-character app password)
SENDER_EMAIL=your-gmail@gmail.com
SENDER_NAME=Your Business Name
```

#### Option B: SendGrid (Best for High Volume)
**Prerequisites:**
1. Create SendGrid account
2. Generate API key with "Mail Send" permissions

**Configuration:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.your-sendgrid-api-key
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Business Name
```

#### Option C: AWS SES (Enterprise)
**Prerequisites:**
1. Setup AWS SES and verify domain
2. Generate SMTP credentials in SES console

**Configuration:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-username
SMTP_PASS=your-ses-password
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Your Business Name
```

### Step 4: Test Configuration

#### Using the Application
1. Go to Settings → Email System → SMTP tab
2. Click "Test Production Email Readiness"
3. Verify success message shows "Function Secrets (Production Ready)"

#### Using CLI (Alternative)
```bash
# Test SMTP connection
curl -X POST \
  https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/smtp-auth-healthcheck \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

### Step 5: Verify Production Mode

#### Check Configuration Source
The system should report:
- ✅ "Using Function Secrets configuration (Production)"
- ❌ "Using Database configuration (Development)"

#### Environment Detection
Production mode is enabled when:
- `EMAIL_PRODUCTION_MODE=true` OR
- `DENO_ENV=production` OR  
- Supabase URL contains "supabase.co"

### Step 6: Create Required Email Templates

#### Critical Templates (Must Have)
Use the Email Template Manager to create:

1. **order_confirmed** - Order confirmation
   ```html
   Subject: Order Confirmed - {{order_number}}
   Body: Hi {{customer_name}}, your order {{order_number}} for {{amount}} has been confirmed...
   ```

2. **order_out_for_delivery** - Out for delivery
   ```html
   Subject: Your order is on the way!
   Body: Hi {{customer_name}}, your order {{order_number}} is out for delivery...
   ```

3. **order_delivered** - Order delivered
   ```html
   Subject: Order delivered - {{order_number}}
   Body: Hi {{customer_name}}, your order {{order_number}} has been delivered...
   ```

4. **customer_welcome** - Welcome email
   ```html
   Subject: Welcome to {{business_name}}!
   Body: Hi {{customer_name}}, welcome to our store...
   ```

### Security Validation Checklist

#### Function Secrets Security
- [ ] Secrets configured in Supabase dashboard (not code)
- [ ] SMTP_PASS is app-specific password (not regular password)
- [ ] No credentials stored in database tables
- [ ] Production mode environment variables set

#### Email Security
- [ ] SPF record configured for your domain
- [ ] DKIM signing enabled with email provider
- [ ] DMARC policy configured
- [ ] Sender domain matches business domain

#### System Security
- [ ] RLS policies protect email configuration
- [ ] Rate limiting enabled
- [ ] Audit logging active
- [ ] Error handling doesn't expose credentials

### Common Issues & Solutions

#### "Missing Function Secrets" Error
**Problem:** Environment variables not configured
**Solution:** Double-check variable names match exactly (case-sensitive)

#### "Authentication Failed" Error  
**Problem:** Incorrect SMTP credentials
**Solution:**
- Gmail: Use App Password, not regular password
- SendGrid: Use "apikey" as username
- Check provider documentation

#### "Production Mode Not Detected" Warning
**Problem:** Environment variables not set correctly
**Solution:** Ensure EMAIL_PRODUCTION_MODE=true is configured

#### "Template Not Found" Error
**Problem:** Required templates missing
**Solution:** Create templates using Email Template Manager

### Maintenance & Monitoring

#### Regular Tasks
- Monitor email delivery rates (should be >95%)
- Check Function Secrets haven't expired
- Review audit logs for suspicious activity
- Update templates as business needs change

#### Alerting Setup
Configure alerts for:
- SMTP connection failures
- High email bounce rates  
- Template rendering errors
- Rate limit violations

### Rollback Plan

#### If Issues Occur
1. **Immediate:** Switch back to database configuration temporarily
2. **Investigate:** Check Function Secrets and provider status
3. **Fix:** Correct configuration issues
4. **Test:** Verify before re-enabling production mode

#### Emergency Contacts  
- Email provider support
- Development team lead
- System administrator

---

## 🚀 Final Verification

### Pre-Launch Checklist
- [ ] All Function Secrets configured and tested
- [ ] Production mode enabled and verified
- [ ] Critical email templates created and active
- [ ] SMTP connection healthy and monitored
- [ ] Team trained on email system management
- [ ] Incident response procedures documented

**⚠️ IMPORTANT**: Never store production SMTP credentials in your database or code. Function Secrets provide the secure, production-ready approach for sensitive configuration.

### Support Links
- [Supabase Function Secrets Dashboard](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/settings/functions)
- [Edge Function Logs](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs/functions/unified-smtp-sender/logs)
- [Gmail App Password Setup](https://support.google.com/accounts/answer/185833)
- [SendGrid SMTP Setup](https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api)
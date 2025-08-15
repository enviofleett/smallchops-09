# SMTP Production Setup Guide

## 🎯 Environment Variables Required

Set these in your Supabase Dashboard > Settings > Edge Functions:

```bash
# CRITICAL: Set your production domain
ALLOWED_ORIGINS="https://yourdomain.com"

# Environment mode
DENO_ENV="production"

# Optional SMTP fallback (if database config fails)
SMTP_HOST="mail.enviofleet.com"
SMTP_PORT="587"
SMTP_USER="support@enviofleet.com"
SMTP_PASS="your-smtp-password"
SMTP_SECURE="true"
SENDER_EMAIL="support@enviofleet.com"
SENDER_NAME="EnvioFleet"
```

## ✅ What Was Fixed

1. **Production CORS**: Updated `smtp-email-sender` function to use environment-aware CORS
2. **Database Schema**: Added `smtp_secure` column to `communication_settings` table
3. **SMTP Settings**: Updated components to handle SSL/TLS secure connections
4. **Error Handling**: Improved database queries using `maybeSingle()` instead of `single()`

## 🧪 Testing Your SMTP Connection

1. Go to Settings > Communications Tab > SMTP Settings
2. Enter your SMTP credentials:
   - Host: `mail.enviofleet.com`
   - Port: `587`
   - Username: `support@enviofleet.com`
   - Password: Your SMTP password
   - Enable "Use Secure Connection (TLS/SSL)"
3. Click "Test SMTP Connection"
4. Check your email for the test message

## 🔧 Troubleshooting

If connection still fails:
- Verify your SMTP credentials are correct
- Check if your email provider requires app-specific passwords
- Ensure port 587 is not blocked by your hosting provider
- Verify the hostname `mail.enviofleet.com` is correct

## 📋 Production Checklist

- [ ] `ALLOWED_ORIGINS` set to your production domain
- [ ] `DENO_ENV` set to "production"
- [ ] SMTP test email successful
- [ ] No CORS errors in browser console
- [ ] SSL/TLS connection enabled for SMTP
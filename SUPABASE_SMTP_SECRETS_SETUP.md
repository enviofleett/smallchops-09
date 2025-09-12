# Supabase Function Secrets Setup for SMTP

## 🔐 Configuring SMTP Credentials in Supabase Dashboard

This guide walks you through setting up SMTP credentials as Function Secrets in your Supabase project dashboard for secure email delivery.

---

## Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in to your account
3. Select your project from the project list

---

## Step 2: Navigate to Function Secrets

1. In the left sidebar, click on **"Settings"** (gear icon)
2. Under the Settings menu, click on **"Edge Functions"**
3. You'll see tabs at the top - click on **"Environment Variables"**

---

## Step 3: Add Required SMTP Secrets

Click the **"Add new variable"** button for each of the following secrets:

### Required Variables:

#### 1. SMTP Host
```
Variable Name: SMTP_HOST
Value: [Your SMTP server address]
```
**Examples:**
- `smtp.gmail.com` (Gmail)
- `smtp-mail.outlook.com` (Outlook)
- `smtp.sendgrid.net` (SendGrid)
- `email-smtp.us-east-1.amazonaws.com` (AWS SES)

#### 2. SMTP Port
```
Variable Name: SMTP_PORT  
Value: [Port number]
```
**Common values:**
- `587` (Most providers with STARTTLS)
- `465` (SSL/TLS)
- `25` (Not recommended for production)

#### 3. SMTP User
```
Variable Name: SMTP_USER
Value: [Your username or email]
```
**Examples:**
- `your-email@gmail.com` (Gmail)
- `apikey` (SendGrid - literally the word "apikey")
- `your-ses-username` (AWS SES)

#### 4. SMTP Password
```
Variable Name: SMTP_PASS
Value: [Your password or API key]
```
**Important Notes:**
- For Gmail: Use App Password (not regular password)
- For SendGrid: Use your API key
- For AWS SES: Use your SMTP password (not AWS secret key)

#### 5. SMTP Security
```
Variable Name: SMTP_SECURE
Value: false
```
**Values:**
- `false` for port 587 (STARTTLS)
- `true` for port 465 (SSL/TLS)

#### 6. Sender Email
```
Variable Name: SENDER_EMAIL
Value: [Your from email address]
```
**Example:** `noreply@yourdomain.com`

#### 7. Sender Name
```
Variable Name: SENDER_NAME
Value: [Your business name]
```
**Example:** `Your Business Name`

---

## Step 4: Optional Environment Variables

### Development vs Production
```
Variable Name: DENO_ENV
Value: production
```

### CORS Configuration
```
Variable Name: ALLOWED_ORIGINS
Value: https://yourdomain.com,https://app.yourdomain.com
```

---

## Step 5: Save and Verify

1. After adding all variables, click **"Save"** for each one
2. The variables will be encrypted and stored securely
3. They will be available to all your Edge Functions immediately

---

## 📋 Quick Setup Checklist

- [ ] SMTP_HOST configured
- [ ] SMTP_PORT configured  
- [ ] SMTP_USER configured
- [ ] SMTP_PASS configured
- [ ] SMTP_SECURE configured
- [ ] SENDER_EMAIL configured
- [ ] SENDER_NAME configured
- [ ] All variables saved successfully

---

## 🔍 Verification Steps

After setting up the secrets:

1. Go to your application
2. Navigate to Settings → Communication Settings
3. Click **"Test Connection"** button
4. You should see a success message: ✅ "Production SMTP Authentication Successful"

---

## 🚨 Common Issues and Solutions

### Issue: "SMTP Authentication Failed"
**Solutions:**
- Double-check your SMTP_USER and SMTP_PASS values
- For Gmail: Ensure you're using an App Password
- For SendGrid: Verify your API key has mail sending permissions

### Issue: "Connection Timeout"
**Solutions:**
- Verify SMTP_HOST is correct
- Check that SMTP_PORT matches your provider's requirements
- Ensure your hosting provider allows outbound SMTP connections

### Issue: "TLS/SSL Error"
**Solutions:**
- For port 587: Set SMTP_SECURE to `false`
- For port 465: Set SMTP_SECURE to `true`
- Never use port 25 for production

---

## 🔒 Security Best Practices

### ✅ Do:
- Use Function Secrets for all sensitive SMTP credentials
- Use App Passwords for Gmail (never your regular password)
- Regularly rotate your SMTP credentials
- Use dedicated email service providers for production

### ❌ Don't:
- Store SMTP credentials in your codebase
- Use your personal email password for SMTP
- Share SMTP credentials in plain text
- Use port 25 for production email sending

---

## 📧 Provider-Specific Quick Setup

### Gmail Setup
```
SMTP_HOST: smtp.gmail.com
SMTP_PORT: 587
SMTP_USER: your-gmail@gmail.com
SMTP_PASS: [16-character App Password]
SMTP_SECURE: false
```

### SendGrid Setup
```
SMTP_HOST: smtp.sendgrid.net
SMTP_PORT: 587
SMTP_USER: apikey
SMTP_PASS: [Your SendGrid API Key]
SMTP_SECURE: false
```

### AWS SES Setup
```
SMTP_HOST: email-smtp.us-east-1.amazonaws.com
SMTP_PORT: 587
SMTP_USER: [Your SES SMTP Username]
SMTP_PASS: [Your SES SMTP Password]
SMTP_SECURE: false
```

---

## 🎯 Next Steps

After configuring Function Secrets:

1. Test your SMTP connection in the app
2. Send a test email to verify delivery
3. Check the Edge Function logs for any issues
4. Configure your email templates as needed
5. Set up domain authentication (SPF, DKIM, DMARC)

---

## 💡 Pro Tips

- **Use a dedicated email service** like SendGrid, Mailgun, or AWS SES for better deliverability
- **Set up email authentication** (SPF, DKIM, DMARC) for your domain
- **Monitor your email delivery** through your provider's dashboard
- **Keep backup credentials** for a secondary email provider

---

**Remember:** Function Secrets are the secure way to store sensitive configuration. Never put SMTP credentials directly in your code or database!
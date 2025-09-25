# Production Payment System Setup Guide

## ✅ Pre-Deployment Checklist

### 1. **Environment Variables (Required)**
Set these in Supabase Dashboard → Edge Functions → Settings:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=your-paystack-secret-key
SITE_URL=https://your-production-domain.com
```

### 2. **Authentication Configuration**
In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://your-production-domain.com`
- **Redirect URLs**: Add your domain and any staging URLs

### 3. **Database Security**
Run security scan to ensure RLS policies are properly configured:
```sql
-- Check all tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;
```

### 4. **Edge Function Deployment**
```bash
# Deploy both functions
supabase functions deploy process-checkout
supabase functions deploy paystack-secure

# Verify deployment
supabase functions logs process-checkout --follow
supabase functions logs paystack-secure --follow
```

## 🔧 Testing Production Flow

### 1. **Test Authentication**
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/process-checkout' \
  -H 'Authorization: Bearer YOUR_USER_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "customer": {"email": "test@example.com", "name": "Test User"},
    "items": [{"product_id": "123", "quantity": 1, "unit_price": 100}],
    "fulfillment": {"type": "pickup"}
  }'
```

### 2. **Monitor Logs**
- Check for 401 errors in Edge Function logs
- Verify payment initialization succeeds
- Confirm email notifications are queued

## 🚨 Common Production Issues & Fixes

### Issue: "Invalid JWT" Error
**Fix**: Ensure service role key is used for internal function calls

### Issue: "Payment service not configured" 
**Fix**: Set PAYSTACK_SECRET_KEY in Edge Functions settings

### Issue: CORS errors
**Fix**: Verify SITE_URL matches your production domain

## 📊 Production Monitoring

### Key Metrics to Monitor:
- Payment success rate (should be >95%)
- Edge Function response times (<2s)
- Error rates in audit_logs table
- Communication event delivery rates

### Alert Setup:
```sql
-- Monitor failed payments
SELECT COUNT(*) as failed_payments 
FROM payment_transactions 
WHERE status = 'failed' 
AND created_at > NOW() - INTERVAL '1 hour';

-- Monitor Edge Function errors
SELECT COUNT(*) as function_errors
FROM audit_logs 
WHERE category = 'Critical Error'
AND created_at > NOW() - INTERVAL '1 hour';
```

## 🔒 Security Best Practices

1. **Never expose service role key to frontend**
2. **Use HTTPS only in production**
3. **Implement rate limiting for payment endpoints**
4. **Monitor suspicious payment patterns**
5. **Regular security audits of database functions**

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] Authentication URLs set
- [ ] Edge functions deployed
- [ ] Database security verified
- [ ] Payment flow tested end-to-end
- [ ] Monitoring alerts configured
- [ ] Error handling tested
- [ ] Backup procedures in place

## 🆘 Emergency Procedures

### If payments fail completely:
1. Check Edge Function logs immediately
2. Verify Paystack API status
3. Rollback to previous working version if needed
4. Contact Paystack support if API issues

### If high error rates:
1. Enable detailed logging temporarily
2. Check database connection health
3. Verify authentication configuration
4. Scale Edge Functions if needed
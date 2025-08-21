# 🔧 PAYSTACK ENVIRONMENT SETUP GUIDE

## 🚨 URGENT: Fix "Payment system configuration issue" Error

The error you're seeing in the checkout flow is caused by **missing Paystack environment variables**. Here's how to fix it:

---

## ⚡ IMMEDIATE FIX REQUIRED

### Step 1: Set Paystack Secret Key in Supabase

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs
2. **Navigate to**: Project Settings → Edge Functions → Environment Variables
3. **Add New Variable**:
   - **Name**: `PAYSTACK_SECRET_KEY`
   - **Value**: Your Paystack secret key (starts with `sk_test_` or `sk_live_`)
4. **Save** the variable

### Step 2: Redeploy Edge Functions (if needed)

If the issue persists after adding the environment variable:
1. Go to **Edge Functions** in Supabase Dashboard
2. Find the `paystack-secure` function
3. Click **Deploy** to refresh the function with new environment variables

---

## 🔍 DIAGNOSIS

### Root Cause
The `paystack-secure` function is looking for environment variables in this order:
1. `PAYSTACK_SECRET_KEY`
2. `PAYSTACK_SECRET_KEY_TEST`
3. `PAYSTACK_SECRET_KEY_LIVE`

If **none** of these are found, the function throws:
```
"Paystack secret key not configured"
```

This error propagates up the chain and causes the frontend to display:
```
"Payment system configuration issue. Please contact support."
```

### Error Flow
```
User clicks "Proceed to Payment"
       ↓
process-checkout function calls paystack-secure
       ↓
paystack-secure checks for PAYSTACK_SECRET_KEY
       ↓
❌ Environment variable not found
       ↓
Returns error: "Paystack secret key not configured"
       ↓
Frontend shows: "Payment system configuration issue"
```

---

## 🎯 REQUIRED ENVIRONMENT VARIABLES

### For Supabase Edge Functions

Add these in **Supabase Dashboard → Project Settings → Edge Functions → Environment Variables**:

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `PAYSTACK_SECRET_KEY` | Your Paystack secret key | `sk_test_abc123...` or `sk_live_xyz789...` |
| `SUPABASE_URL` | Your Supabase URL | `https://oknnklksdiqaifhxaccs.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |

### For Frontend (Already Configured)

These are already set up in the frontend code:
- `VITE_SUPABASE_URL` (via environment variables or fallback)
- `VITE_SUPABASE_ANON_KEY` (via environment variables or fallback)

---

## 🔑 GET YOUR PAYSTACK KEYS

### Test Environment (Development)
1. Go to [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developers)
2. Click on **API Keys & Webhooks**
3. Copy the **Test Secret Key** (starts with `sk_test_`)

### Live Environment (Production)
1. Go to [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developers)
2. Click on **API Keys & Webhooks**
3. Copy the **Live Secret Key** (starts with `sk_live_`)

⚠️ **Never commit secret keys to your repository!**

---

## ✅ VERIFICATION STEPS

### 1. Test Payment Initialization
After setting the environment variable:
1. Go to your app's checkout page
2. Add items to cart
3. Click "Proceed to Payment"
4. The error should be resolved

### 2. Check Function Logs
1. Go to **Supabase Dashboard → Edge Functions**
2. Click on `paystack-secure` function
3. Check the **Logs** tab for any errors

### 3. Use Diagnostic Tool
The app includes a diagnostic tool at `/settings` (admin area):
- Look for **Payment Configuration Diagnostic**
- Run the diagnostic to check all components

---

## 🔧 ADVANCED TROUBLESHOOTING

### If the Error Persists

1. **Check Environment Variable Format**:
   ```
   ✅ Correct: PAYSTACK_SECRET_KEY
   ❌ Wrong: paystack_secret_key
   ❌ Wrong: PAYSTACK-SECRET-KEY
   ```

2. **Verify Secret Key Format**:
   ```
   ✅ Test: sk_test_abc123def456...
   ✅ Live: sk_live_xyz789uvw012...
   ❌ Wrong: pk_test_... (this is a public key)
   ```

3. **Check Function Deployment**:
   - Ensure the `paystack-secure` function is deployed
   - Check for any deployment errors in the logs

4. **Verify Network Access**:
   - Ensure the function can reach `https://api.paystack.co`
   - Check for any firewall or network restrictions

### Common Errors and Solutions

| Error Message | Cause | Solution |
|---------------|--------|----------|
| "Paystack secret key not configured" | Missing environment variable | Add `PAYSTACK_SECRET_KEY` |
| "Paystack API error (401)" | Invalid secret key | Check key format and validity |
| "Paystack API error (404)" | Wrong endpoint or key | Verify key type (test vs live) |
| "Network error" | Connectivity issue | Check internet connection |

---

## 🛡️ SECURITY BEST PRACTICES

1. **Environment Separation**:
   - Use test keys for development/staging
   - Use live keys only for production

2. **Key Management**:
   - Store keys only in Supabase environment variables
   - Never commit keys to code repository
   - Rotate keys periodically

3. **Access Control**:
   - Limit access to production keys
   - Use service role keys only where necessary

---

## 📞 SUPPORT

If you continue to experience issues after following this guide:

1. **Check the diagnostic tool** in your admin settings
2. **Review Supabase function logs** for detailed error messages
3. **Verify your Paystack account** is active and in good standing
4. **Test with a minimal payload** to isolate the issue

---

## 🎉 COMPLETION CHECKLIST

- [ ] Added `PAYSTACK_SECRET_KEY` to Supabase environment variables
- [ ] Verified secret key format (starts with `sk_test_` or `sk_live_`)
- [ ] Tested checkout flow - no more "configuration issue" error
- [ ] Checked diagnostic tool shows "healthy" status
- [ ] Verified payments can be initialized successfully

---

*This guide resolves the "Payment system configuration issue" error in your checkout flow.*

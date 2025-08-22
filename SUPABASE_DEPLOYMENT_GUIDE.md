# 🚀 Supabase Functions Deployment Guide

## 📋 Overview
This guide helps you deploy the required Supabase Edge Functions for the payment system to work properly.

## 🎯 Functions to Deploy

### **Critical Payment Functions:**
1. **paystack-secure** - Handles payment initialization and verification
2. **paystack-debug** - Provides debugging and health checks
3. **payment-callback** - Processes payment verification callbacks
4. **process-checkout** - Handles order creation and checkout flow

## 🔧 Method 1: Using Supabase Dashboard (Recommended)

### **Step 1: Access Supabase Dashboard**
1. Go to: [https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs)
2. Sign in to your Supabase account

### **Step 2: Navigate to Edge Functions**
1. In the left sidebar, click **"Edge Functions"**
2. You should see a list of available functions or an option to create new ones

### **Step 3: Deploy Functions**
For each function, you'll need to:

1. **Click "Create Function" or "Deploy"**
2. **Upload the function code:**
   - Function Name: `paystack-secure`
   - Source: Copy content from `supabase/functions/paystack-secure/index.ts`
   - Click Deploy

3. **Repeat for other functions:**
   - `paystack-debug` (from `supabase/functions/paystack-debug/index.ts`)
   - `payment-callback` (from `supabase/functions/payment-callback/index.ts`)
   - `process-checkout` (from `supabase/functions/process-checkout/index.ts`)

### **Step 4: Set Environment Variables**
1. Go to **Project Settings** → **Environment Variables**
2. Add these variables:

```
PAYSTACK_SECRET_KEY_TEST=sk_test_0311ba51e34c9ab686b86850bd70294634d3e41f
PAYSTACK_SECRET_KEY=sk_test_0311ba51e34c9ab686b86850bd70294634d3e41f
SUPABASE_URL=https://oknnklksdiqaifhxaccs.supabase.co
```

**Note:** You'll also need your `SUPABASE_SERVICE_ROLE_KEY` (get this from Project Settings → API)

## 🔧 Method 2: Using Supabase CLI (If Available)

If you have Supabase CLI installed:

```bash
# Deploy all functions
supabase functions deploy paystack-secure
supabase functions deploy paystack-debug
supabase functions deploy payment-callback
supabase functions deploy process-checkout

# Set environment variables
supabase secrets set PAYSTACK_SECRET_KEY_TEST=sk_test_0311ba51e34c9ab686b86850bd70294634d3e41f
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_0311ba51e34c9ab686b86850bd70294634d3e41f
```

## 📦 Function Source Files

### **paystack-secure** (`supabase/functions/paystack-secure/index.ts`)
- **Purpose:** Secure payment initialization and verification
- **Actions:** `initialize`, `verify`
- **Required Env Vars:** `PAYSTACK_SECRET_KEY_TEST`, `PAYSTACK_SECRET_KEY`

### **paystack-debug** (`supabase/functions/paystack-debug/index.ts`)
- **Purpose:** Health checks and debugging
- **Actions:** `check_key_health`, `check_reference`
- **Required Env Vars:** `PAYSTACK_SECRET_KEY_TEST`, `PAYSTACK_SECRET_KEY`

### **payment-callback** (`supabase/functions/payment-callback/index.ts`)
- **Purpose:** Handle payment verification callbacks
- **Required Env Vars:** `PAYSTACK_SECRET_KEY_TEST`, `PAYSTACK_SECRET_KEY`

### **process-checkout** (`supabase/functions/process-checkout/index.ts`)
- **Purpose:** Process order creation and checkout
- **Required Env Vars:** Various order and customer settings

## ✅ Verification Steps

After deployment, test using these tools:

1. **Open:** `/test-direct-functions.html`
   - Should show functions returning status 200 (not 404)

2. **Open:** `/verify-paystack-credentials.html`
   - Should show successful credential tests

3. **Open:** `/payment-flow-debug.html`
   - Should complete all steps successfully

## 🚨 Common Issues and Solutions

### **Issue: 404 Errors Persist**
- **Cause:** Functions not properly deployed
- **Solution:** Re-deploy functions, check function names match exactly

### **Issue: 500 Errors**
- **Cause:** Missing environment variables
- **Solution:** Ensure all env vars are set in Supabase dashboard

### **Issue: CORS Errors**
- **Cause:** Function JWT verification settings
- **Solution:** Ensure `verify_jwt = false` for public functions

### **Issue: Invalid Key Errors**
- **Cause:** Environment variables not properly set
- **Solution:** Double-check Paystack keys in dashboard

## 🎯 Expected Results After Deployment

✅ **paystack-debug health check:** Returns valid key information
✅ **paystack-secure initialization:** Creates payment references starting with `txn_`
✅ **payment-callback verification:** Successfully verifies payment references
✅ **Full payment flow:** No more "Transaction reference not found" errors

## 📞 Need Help?

If deployment fails or you encounter issues:

1. Check Supabase function logs in the dashboard
2. Verify environment variables are set correctly
3. Test individual functions using the provided debug tools
4. Ensure all required dependencies are included in function code

---

**Next Step:** After deployment, run the verification tools to confirm everything is working!

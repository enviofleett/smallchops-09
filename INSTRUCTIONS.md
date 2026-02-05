# Email System Fix Instructions

## Status Update
The excessive email notifications have been **STOPPED** because the old processor function was deleted. However, to restore the email functionality correctly and prevent duplicates in the future, manual intervention is required due to project limits.

## Step 1: Run Database Fix
Since the CLI is blocked by permissions, you must apply the fix manually in the Supabase Dashboard.

1. Go to the [Supabase Dashboard](https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs).
2. Navigate to the **SQL Editor** (left sidebar).
3. Click **New Query**.
4. Copy the entire content of the file [`FIX_EMAIL_SYSTEM.sql`](./FIX_EMAIL_SYSTEM.sql) from your project root.
5. Paste it into the SQL Editor and click **Run**.
   - This creates the atomic locking mechanism (`fetch_and_lock_communication_events`) to prevent race conditions.
   - It updates the trigger to use deterministic keys (preventing duplicates).

## Step 2: Free Up Edge Function Space
Your project has reached the maximum number of Edge Functions (likely 10 for Free Plan). I was unable to delete enough functions via CLI due to permission errors (403).

1. Go to **Edge Functions** in the Dashboard.
2. Delete unused or test functions until you have at least **1 free slot**.
   - Recommended deletions: `emergency-communication-cleanup`, `production-monitor`, `test-*`, etc.

## Step 3: Deploy the Enhanced Processor
Once space is available, deploy the new processor:

```bash
supabase functions deploy process-communication-events-enhanced --no-verify-jwt
```

## Step 4: Verify
1. Create a test order or update an order status.
2. Check `communication_events` table to see a single queued event.
3. Verify only one email is sent.

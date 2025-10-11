# 📧 Email System Production Setup Guide

## 🚨 Critical Issue Found & Fixed

**Problem:** 14,745 emails were stuck in queue, never being sent
**Root Cause:** No automated processor was running to send queued emails

## ✅ Fixes Implemented

### 1. **Email Queue Manager** (NEW)
- **Location:** Admin → Email Templates → Queue Manager tab
- **Features:**
  - Real-time queue statistics (queued, failed, missing templates)
  - Manual processing trigger (process 50 emails immediately)
  - Auto-fix NULL template keys
  - Clear old failed emails (7+ days)
  - Setup instructions for automation

### 2. **Automated Processor Cron Job** (NEW)
- **Edge Function:** `email-queue-processor-cron`
- **Purpose:** Automatically process queued emails every 5 minutes
- **Batch Size:** 50 emails per run (adjusts based on queue size)
- **Alerts:** Warns when queue exceeds 1,000 emails

### 3. **Template Key Fixer** (NEW)
- **Edge Function:** `fix-email-template-keys`
- **Purpose:** Auto-assign correct template_key to events with NULL values
- **Usage:** Click "Fix Now" button in Queue Manager
- **Safe:** Dry-run mode available

## 🔧 Setup Instructions

### Step 1: Fix Existing Queued Emails

1. Go to **Admin → Email Templates → Queue Manager**
2. Click **"Fix Missing Template Keys"** to fix 5,000+ NULL template_key entries
3. Click **"Process Queue Now"** to start sending emails immediately

### Step 2: Enable Automated Processing

**Option A: External Cron Service (Recommended)**

1. Go to [cron-job.org](https://cron-job.org) or similar service
2. Create new cron job:
   - **URL:** `https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-queue-processor-cron`
   - **Method:** POST
   - **Interval:** Every 5 minutes
   - **Headers:** 
     ```
     Authorization: Bearer YOUR_SERVICE_ROLE_KEY
     Content-Type: application/json
     ```
3. Save and enable

**Option B: GitHub Actions**

Create `.github/workflows/email-processor.yml`:

```yaml
name: Process Email Queue
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  process:
    runs-on: ubuntu-latest
    steps:
      - name: Process Emails
        run: |
          curl -X POST \
            https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-queue-processor-cron \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json"
```

**Option C: Vercel Cron Jobs**

Create `vercel.json` in your project root:

```json
{
  "crons": [{
    "path": "/api/process-email-queue",
    "schedule": "*/5 * * * *"
  }]
}
```

Create `api/process-email-queue.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(
    'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/email-queue-processor-cron',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  res.status(200).json(data);
}
```

### Step 3: Monitor & Test

1. **Check Queue Manager** - Verify queue is decreasing
2. **Check Delivery Monitor** - Watch emails change from "queued" to "sent"
3. **Review Failed Emails** - Investigate any failures
4. **Test New Orders** - Place test order, ensure email sends within 5 minutes

## 📊 Email Flow Architecture

```
Order Created
    ↓
communication_events (status: queued)
    ↓
email-queue-processor-cron (every 5 min)
    ↓
process-communication-events-enhanced
    ↓
unified-smtp-sender (SMTP)
    ↓
Email Sent (status: sent)
```

## 🔍 Troubleshooting

### Queue Not Processing
- **Check:** Is cron job running? Check cron service logs
- **Test:** Click "Process Queue Now" in Queue Manager
- **Verify:** Check edge function logs in Supabase dashboard

### Template Key NULL Errors
- **Fix:** Click "Fix Missing Template Keys" in Queue Manager
- **Verify:** Check "Missing Templates" stat = 0

### SMTP Authentication Errors
- **Check:** Function Secrets in Supabase dashboard
- **Required Secrets:**
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM_EMAIL`

### High Queue Count (>1000)
- **Cause:** Processor not running or SMTP issues
- **Fix:** Enable automation (Step 2)
- **Monitor:** Check alerts in edge function logs

## 📈 Monitoring

**Key Metrics to Watch:**
- **Queued Count:** Should stay < 100
- **Failed Count:** Should stay < 1%
- **Missing Templates:** Should stay = 0
- **Processing Time:** Should be < 5 minutes for new emails

**Alerts:**
- Queue > 1,000 emails = Check automation
- Failed > 10% = Check SMTP credentials
- Missing templates > 0 = Run template fixer

## 🎯 Best Practices

1. **Monitor Daily:** Check Queue Manager once per day
2. **Fix Issues Fast:** Address failed emails within 24 hours
3. **Test Changes:** Always test email changes before production
4. **Keep Templates Updated:** Review templates monthly
5. **Archive Old Failed Emails:** Clear 7+ day old failures weekly

## 📞 Support

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Emails not sending | Enable cron job (Step 2) |
| Template errors | Click "Fix Missing Template Keys" |
| SMTP errors | Check Function Secrets |
| High queue | Increase batch size in cron job |

## 🚀 Production Ready Checklist

- [ ] Fix existing NULL template keys
- [ ] Process current queue backlog
- [ ] Set up automated cron job
- [ ] Test order → email flow
- [ ] Monitor for 24 hours
- [ ] Document any custom templates
- [ ] Train team on Queue Manager
- [ ] Set up alerting for failures

---

**Need Help?** Check:
- Edge function logs in Supabase Dashboard
- Queue Manager for real-time stats
- Delivery Monitor for email history

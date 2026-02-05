# Deleted Supabase Edge Functions Log
Date: 2026-02-04
Reason: Free up space for critical `process-communication-events-enhanced` deployment (Max functions limit reached).

The following functions were deleted:

1. `process-emails` (Replaced by enhanced version)
2. `process-email-notifications` (Redundant)
3. `simple-order-email` (Legacy/Simple version)
4. `send-order-email` (Legacy)
5. `paystack-live-test-suite` (Test)
6. `payment-webhook-test` (Test)
7. `fix-email-template-keys` (Utility/One-off)
8. `email-queue-cleanup-stale` (Maintenance)
9. `production-checkout-security` (Security/Test)
10. `email-queue-processor-cron` (Redundant cron)
11. `email-notification-cron` (Redundant cron)
12. `simple-smtp-sender` (Replaced by `unified-smtp-sender`)
13. `communication-event-cleanup` (Maintenance)

Current Critical Function Pending Deployment:
- `process-communication-events-enhanced`

Action Required:
- If deployment still fails with 402, upgrade Supabase plan or delete more non-critical functions (e.g., monitoring functions).



# Edge Function Redundancy Analysis

## Overview

Your project has **133 edge functions** deployed. After cross-referencing each function against frontend invocations and inter-function dependencies, here is the breakdown.

## Category 1: SAFE TO DELETE -- Test/Debug/One-off Utilities (18 functions)

These are test harnesses, debug tools, one-off migration scripts, or emergency fixes that serve no ongoing production purpose:

| Function | Reason Safe to Remove |
|---|---|
| `testing-automation` | E2E/performance/security test harness -- dev-only |
| `production-audit-fix` | One-off audit/fix script |
| `production-deployment-check` | One-off pre-deploy checker |
| `production-environment-setup` | One-off setup utility (invoked from PaystackProductionStatus admin panel only) |
| `production-environment-validator` | One-off validator -- not invoked from frontend |
| `production-monitoring-alerts` | Not invoked from frontend |
| `production-customer-system-monitor` | Not invoked from frontend |
| `test-promotion-system` | Test-only |
| `backfill-missing-schedules` | One-off data migration |
| `payment-recovery-migration` | One-off migration (only used in dev test utility) |
| `emergency-payment-fix` | One-off emergency fix |
| `emergency-payment-reconciliation` | One-off reconciliation |
| `paystack-webhook-test` | Test webhook simulator |
| `seed-admin-users` | One-off seeder |
| `reset-admin-passwords` | One-off admin password reset |
| `log-registration-debug` | Debug logging only |
| `email-template-checker` | Not invoked from frontend |
| `email-queue-cleanup-stale` | Listed in DELETED_FUNCTIONS_LOG as already deleted, but file still exists |

## Category 2: SAFE TO DELETE -- Redundant/Superseded (16 functions)

These overlap with consolidated functions (`email-core`, `unified-smtp-sender`, `unified-email-queue-processor`):

| Function | Superseded By |
|---|---|
| `email-queue-processor` | `unified-email-queue-processor` |
| `email-queue-processor-cron` | `unified-email-queue-processor` (also listed as deleted in log) |
| `email-cron-automation` | `email-core` + `unified-email-queue-processor` |
| `email-cleanup-scheduler` | `email-queue-cleanup` handles this |
| `email-automation-trigger` | `email-core` |
| `email-trigger-manager` | `email-core` |
| `instant-email-processor` | `unified-email-queue-processor` (many UI references, but can be redirected) |
| `enhanced-email-retry` | `unified-email-queue-processor` handles retries |
| `enhanced-email-rate-limiter` | Only used in EmailTestingSimulation admin component |
| `fix-email-template-keys` | One-off fix, listed as deleted but file still exists |
| `supabase-auth-email-sender` | `unified-smtp-sender` |
| `clear-email-queue` | `email-queue-cleanup` |
| `email-service-core` | `email-core` (duplicate naming pattern) |
| `smtp-health-check` | `smtp-health-monitor` and `smtp-auth-healthcheck` cover this |
| `paystack-batch-verifier` | `paystack-batch-verify` (duplicate) |
| `validate-user-type` | No longer called after recent fix |

## Category 3: SAFE TO DELETE -- Redundant Monitoring/Health (10 functions)

Multiple overlapping health/monitoring functions:

| Function | Overlap With |
|---|---|
| `advanced-security-monitor` | `security-monitor` + `security-monitor-alerts` |
| `security-monitoring` | `security-monitor` + `security-monitor-alerts` |
| `payment-health-check` | `payment-health-diagnostic` |
| `paystack-health` | `paystack-health-monitor` |
| `paystack-production-config` | `production-paystack-setup` |
| `email-health-monitor` | `email-production-monitor` + `email-delivery-monitor` |
| `production-health-check` | `production-deployment-check` (both removable) |
| `enhanced-payment-polling` | `verify-payment` already handles polling |
| `enhanced-payment-templates` | Payment templates stored in DB |
| `payment-analytics` | `dashboard-aggregates` covers analytics |

## Category 4: KEEP -- Actively Used in Production (remaining ~89 functions)

Core functions that are actively invoked from the frontend for live features:

- **Payment**: `process-checkout`, `verify-payment`, `paystack-secure`, `paystack-webhook`, `paystack-webhook-secure`, `paystack-banks`, `paystack-health-monitor`, `secure-payment-processor`, `payment-callback`, `payment-environment-manager`, `payment-health-diagnostic`, `payment-integration`, `payment-reconcile`, `payment-recovery`, `payment-timeout-handler`, `refund-management`, `production-paystack-setup`
- **Email**: `email-core`, `unified-smtp-sender`, `unified-email-queue-processor`, `email-delivery-monitor`, `email-production-monitor`, `email-template-seeder`, `email-template-generator`, `email-queue-cleanup`, `email-compliance-manager`, `bounce-complaint-processor`, `welcome-series-processor`, `customer-welcome-processor`, `send-delivery-notification`, `send-out-for-delivery-email`, `unsubscribe-email`, `smtp-auth-healthcheck`, `smtp-health-monitor`
- **Auth/Users**: `auth-register`, `auth-profile`, `auth-verify-otp`, `auth-security-validator`, `customer-auth-register`, `customer-otp-verification`, `secure-customer-auth`, `finalize-customer-registration`, `check-otp-rate-limit`, `role-management`, `role-management-v2`, `admin-user-creator`, `admin-management`, `admin-password-reset`, `admin-security-lockdown`
- **Orders/Business**: `admin-orders-manager`, `admin-order-notification`, `process-order-with-promotions`, `business-settings`, `calculate-vat-breakdown`, `validate-moq-requirements`, `validate-promotion-code`, `validate-promotion-day`, `track-promotion-usage`, `promotion-analytics`, `check-promotion-alerts`, `shipping-fees-report`, `shipping-integration`
- **Public API**: `public-api`, `public-about-api`, `public-blog-api`, `get-products-by-category`, `get-promotional-products`, `get-public-categories`, `get-public-products`
- **Other**: `dashboard-aggregates`, `delivery-availability`, `delivery-booking`, `delivery-schedule-health`, `recover-order-schedule`, `sms-service`, `cart-abandonment-processor`, `track-cart-session`, `customer-experience-manager`, `user-journey-automation`, `review-request-processor`, `process-communication-events-enhanced`, `upload-hero-image`, `upload-logo`, `upload-product-image`, `validate-logo`, `check_upload_rate_limit`, `reports`, `analytics-dashboard`, `security-monitor`, `security-monitor-alerts`

## Summary

| Category | Count | Action |
|---|---|---|
| Test/Debug/One-off | 18 | Delete |
| Redundant/Superseded | 16 | Delete |
| Redundant Monitoring | 10 | Delete |
| **Total Removable** | **44** | **Delete safely** |
| Keep (Active Production) | ~89 | No change |

## Recommended Implementation Approach

1. Delete the 18 test/debug/one-off functions first (zero risk to production)
2. Delete the 16 superseded email/payment functions, updating the ~5 admin UI components that reference them to use the consolidated function names instead
3. Delete the 10 redundant monitoring functions, keeping only one health monitor per domain (email, payment, security)
4. Update `supabase/config.toml` to remove entries for deleted functions

## Risk Notes

- `instant-email-processor` is referenced in ~6 admin UI components. Before deleting it, those references should be updated to call `unified-email-queue-processor` instead.
- `email-service-core` is used by `src/utils/emailOperations.ts` -- redirect to `email-core`.
- `production-paystack-setup` is actively used by `PaystackSetup.tsx` -- keep this one.
- `paystack-debug` is used by `src/lib/paystackDebug.ts` -- useful for debugging but could be removed if you want to minimize; recommend keeping for now.


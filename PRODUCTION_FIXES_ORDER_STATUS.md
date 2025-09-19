# CRITICAL: Production Order Status Update Fixes

## Issue Summary
**Error**: `duplicate key value violates unique constraint "communication_events_dedupe_key_unique"`
**Impact**: Order status updates failing in production
**Frequency**: Multiple occurrences in last 24 hours

## Root Cause
The `dedupe_key` generation in communication_events is creating identical keys for:
- Rapid consecutive order status updates
- Retry attempts on the same order
- Multiple admin sessions updating same order

## IMMEDIATE FIXES NEEDED (Priority: CRITICAL)

### 1. Database Fix - Improve Deduplication Strategy
```sql
-- Update the dedupe_key generation to include timestamp + random component
-- This should be implemented in the edge function that creates communication_events

-- Alternative: Add composite unique constraint instead of single dedupe_key
ALTER TABLE communication_events DROP CONSTRAINT communication_events_dedupe_key_unique;
ALTER TABLE communication_events ADD CONSTRAINT communication_events_dedupe_key_unique 
UNIQUE (dedupe_key, order_id, event_type);
```

### 2. Edge Function Fix - Better Dedupe Key Generation
Update `admin-orders-manager` edge function to use:
```javascript
const dedupeKey = `${orderId}_${status}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

### 3. Application-Level Fix - Prevent Rapid Clicks
Add debouncing to status update buttons (500ms minimum between clicks)

### 4. Error Recovery - ON CONFLICT Handling
Implement `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` in communication_events inserts

## MONITORING & ALERTING

### 1. Real-time Error Detection
- Alert on any `communication_events_dedupe_key_unique` constraint violations
- Track order status update success/failure rates
- Monitor edge function execution times

### 2. Dashboard Metrics
- Order status update latency (should be < 2 seconds)
- Failed update rate (should be < 1%)
- Communication event delivery rate

## TESTING VERIFICATION

### Test Cases:
1. Rapid status updates on same order (< 1 second apart)
2. Multiple admin sessions updating same order simultaneously  
3. Network retry scenarios with duplicate requests
4. Large volume of order updates (stress test)

## ROLLBACK PLAN
If fixes cause issues:
1. Revert edge function changes
2. Temporarily disable communication event creation for status updates
3. Manual status updates through direct database access

## SUCCESS CRITERIA
- Zero `dedupe_key_unique` constraint violations
- Order status updates complete in < 2 seconds
- 99.5%+ success rate for status updates
- No user-facing error messages related to duplicates
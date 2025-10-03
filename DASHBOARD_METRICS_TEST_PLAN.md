# Dashboard Metrics - Production Testing Plan

## Overview
This document outlines the testing strategy for the dashboard metrics system after the production audit and fixes.

## Test Environment Setup

### Prerequisites
1. Access to production or staging environment
2. Test user account with appropriate permissions
3. Sample data with:
   - Orders with different payment statuses (paid, confirmed, completed)
   - Cancelled orders
   - Orders spanning multiple days
   - Orders at timezone boundaries (e.g., 23:00-01:00 Lagos time)

### Environment Variables
Verify these are set correctly:
```bash
VITE_SUPABASE_URL=https://oknnklksdiqaifhxaccs.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## Test Cases

### 1. Lagos Timezone Verification

#### Test 1.1: Date Boundary Orders
**Objective**: Verify orders are grouped by Lagos timezone days, not UTC days

**Steps**:
1. Create test orders at different times:
   - 23:30 Lagos time (22:30 UTC) on Day 1
   - 00:30 Lagos time (23:30 UTC previous day) on Day 2
2. View dashboard with date range covering both days
3. Verify order counts for each day

**Expected Results**:
- Order at 23:30 Lagos time appears on Day 1
- Order at 00:30 Lagos time appears on Day 2
- UTC times are correctly converted to Lagos time

**Console Logs to Check**:
```
[Lagos Timezone Debug] Querying with Lagos timezone: {
  lagosStart: "YYYY-MM-DD 00:00",
  lagosEnd: "YYYY-MM-DD 23:59",
  utcStart: "<UTC ISO string>",
  utcEnd: "<UTC ISO string>",
  lagosOffsetHours: 1
}
```

#### Test 1.2: Multi-day Date Range
**Objective**: Verify correct aggregation across multiple days

**Steps**:
1. Select "Last 7 Days" preset
2. Verify all 7 days appear in metrics
3. Check that each day's metrics are accurate

**Expected Results**:
- Exactly 7 days of data displayed
- Each day starts at 00:00 Lagos time
- Each day ends at 23:59 Lagos time

### 2. Payment Status and Cancellation Logic

#### Test 2.1: All Legitimate Payment Statuses
**Objective**: Verify all legitimate orders are counted

**Steps**:
1. Create orders with different payment statuses:
   - payment_status = 'paid'
   - payment_status = 'confirmed'
   - payment_status = 'completed'
2. View dashboard
3. Check order counts

**Expected Results**:
- All three orders appear in metrics
- Revenue reflects all three orders
- Console shows: `[Debug] Fetched 3 orders with legitimate payment status`

#### Test 2.2: Cancelled Orders Tracking
**Objective**: Verify cancelled orders are tracked separately

**Steps**:
1. Create order with status = 'cancelled'
2. Create order with payment_status = 'paid'
3. View dashboard daily metrics
4. Check orders chart

**Expected Results**:
- Completed orders shown in primary color (blue)
- Cancelled orders shown in red
- Chart legend shows both categories
- Summary card shows "X cancelled"
- Console shows: `[Debug] Fetched 1 cancelled orders`

#### Test 2.3: Mixed Status Orders
**Objective**: Verify correct separation of completed vs cancelled

**Setup**: Create 10 orders:
- 7 with payment_status in ['paid', 'confirmed', 'completed']
- 3 with status = 'cancelled'

**Expected Results**:
- Main order count: 7
- Cancelled order count: 3
- Chart shows both segments clearly

### 3. Date Range Selector Functionality

#### Test 3.1: Preset Selections
**Objective**: Verify preset date ranges work correctly

**Steps**:
1. Click "Today" button
2. Verify date range is correct
3. Repeat for "7 Days" and "30 Days"

**Expected Results**:
- Today: Shows current day only
- 7 Days: Shows last 7 days (including today)
- 30 Days: Shows last 30 days (including today)
- Toast notification: "Date range updated"
- Console log: `[DateRangeSelector] Preset changed: { preset: "...", startDate: "...", endDate: "..." }`

#### Test 3.2: Custom Date Selection
**Objective**: Verify custom date picker works

**Steps**:
1. Click on date range dropdown
2. Select custom start date
3. Select custom end date
4. Click "Apply"

**Expected Results**:
- Date range updates
- Metrics refresh with new data
- Display shows custom date range
- Console log: `[DateRangeSelector] Custom date selected`

#### Test 3.3: Invalid Date Ranges
**Objective**: Verify validation prevents invalid ranges

**Test Cases**:
| Start Date | End Date | Expected Behavior |
|------------|----------|-------------------|
| 2024-01-10 | 2024-01-05 | Error: "Start date must be before end date." |
| invalid | 2024-01-05 | Error: "Invalid date format." |
| 2024-01-01 | invalid | Error: "Invalid date format." |

**Steps**:
1. Attempt to set invalid date range
2. Verify error message appears
3. Verify range is not applied

### 4. Authentication Error Handling

#### Test 4.1: Expired Session
**Objective**: Verify graceful handling of expired sessions

**Steps**:
1. Log in to application
2. Wait for session to expire (or manually invalidate token)
3. Try to view daily metrics
4. Observe error handling

**Expected Results**:
- Error message: "Your session has expired. Please refresh the page or log in again."
- "Refresh Page" button appears
- "Retry" button appears
- Console log: `[Auth Error] Session retrieval failed` or `[Auth Warning] No active session found`

#### Test 4.2: Insufficient Permissions
**Objective**: Verify handling of permission errors

**Steps**:
1. Log in with user that lacks analytics permissions
2. Try to view daily metrics

**Expected Results**:
- Error message: "You do not have permission to view analytics. Please contact your administrator."
- Appropriate HTTP 403 handling
- Console log: `[Analytics API] Error response: { status: 403, ... }`

#### Test 4.3: Server Errors
**Objective**: Verify handling of server errors

**Simulation**: Mock 500 error response

**Expected Results**:
- Error message: "The server encountered an error. Please try again in a few moments."
- Retry button available
- Retry logic with exponential backoff

### 5. Data Accuracy Verification

#### Test 5.1: Cross-Reference with Database
**Objective**: Ensure dashboard metrics match database

**Steps**:
1. Select specific date range
2. Note dashboard metrics (orders, revenue, customers)
3. Query database directly for same date range
4. Compare results

**Database Query Example**:
```sql
-- Orders count for date range (Lagos timezone)
SELECT 
  DATE(order_time AT TIME ZONE 'Africa/Lagos') as order_date,
  COUNT(*) as order_count,
  SUM(total_amount) as total_revenue
FROM orders
WHERE 
  order_time AT TIME ZONE 'Africa/Lagos' >= '2024-01-01 00:00:00'
  AND order_time AT TIME ZONE 'Africa/Lagos' <= '2024-01-31 23:59:59'
  AND payment_status IN ('paid', 'confirmed', 'completed')
GROUP BY order_date
ORDER BY order_date;
```

**Expected Results**:
- Dashboard counts match database counts
- Revenue totals match exactly
- Customer counts match unique customers

#### Test 5.2: Summary Calculations
**Objective**: Verify summary totals are accurate

**Steps**:
1. View daily metrics for 7 days
2. Manually add up each day's:
   - Orders
   - Revenue
   - Customers
   - New products
3. Compare with summary totals

**Expected Results**:
- totalOrders = sum of all daily orders
- totalRevenue = sum of all daily revenue
- totalCancelledOrders = sum of all daily cancellations
- Averages calculated correctly

### 6. Performance and Load Testing

#### Test 6.1: Large Date Ranges
**Objective**: Test performance with large datasets

**Test Cases**:
| Date Range | Expected Behavior |
|------------|-------------------|
| 1 month | Fast (<2 seconds) |
| 3 months | Acceptable (<5 seconds) |
| 1 year | Slow but functional (<15 seconds) |

**Steps**:
1. Select different date ranges
2. Measure load time
3. Verify all data loads correctly

#### Test 6.2: Concurrent Users
**Objective**: Test system under load

**Steps**:
1. Have multiple users access dashboard simultaneously
2. Monitor system performance
3. Check for any errors or timeouts

### 7. Browser Compatibility

#### Test 7.1: Cross-Browser Testing
**Browsers to Test**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Elements to Verify**:
- Date picker functionality
- Charts render correctly
- Error messages display properly
- Responsive design works

#### Test 7.2: Mobile Responsiveness
**Devices**:
- iPhone (Safari)
- Android (Chrome)
- Tablet

**Elements to Verify**:
- Date selector is usable
- Charts are readable
- Touch interactions work
- Layout adapts properly

## Console Log Verification

### Expected Log Sequence for Successful Load

```javascript
// 1. Dashboard date range change
[Dashboard] Date range changed: { startDate: "2024-01-01", endDate: "2024-01-31" }

// 2. API call start
[Analytics API] Fetching daily analytics (attempt 1/3)...
[Analytics API] Session validated successfully
[Analytics API] Calling endpoint: { url: "...", startDate: "2024-01-01", endDate: "2024-01-31" }

// 3. API response
[Analytics API] Response status: 200
[Analytics API] Received data structure: { hasDailyData: true, dailyDataLength: 31, hasSummary: true, hasError: false }

// 4. Backend logs (from Edge Function)
[Lagos Timezone Debug] Querying with Lagos timezone: { ... }
[Debug] Fetched 42 orders with legitimate payment status
[Debug] Fetched 5 cancelled orders
[Debug] Initialized 31 days in date range
[Debug] Aggregated 42 legitimate orders
[Debug] Aggregated 5 cancelled orders
[Debug] Daily analytics summary: { totalDays: 31, totalRevenue: 500000, totalOrders: 42, totalCancelledOrders: 5, totalCustomers: 30 }
```

## Issue Reporting Template

When reporting issues, include:
```markdown
**Issue Description**:
[Brief description of the problem]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior**:
[What should happen]

**Actual Behavior**:
[What actually happened]

**Console Logs**:
```
[Paste relevant console logs here]
```

**Environment**:
- Browser: [e.g., Chrome 120]
- Date Range: [e.g., 2024-01-01 to 2024-01-31]
- User Role: [e.g., admin]

**Screenshots**:
[Attach if applicable]
```

## Success Criteria

The system passes testing if:
- ✅ All payment statuses are correctly included in metrics
- ✅ Cancelled orders are tracked separately and displayed correctly
- ✅ Lagos timezone is consistently applied and documented in logs
- ✅ Date picker works for all preset and custom ranges
- ✅ Invalid date ranges are properly validated
- ✅ Authentication errors show user-friendly messages
- ✅ All metrics match database queries
- ✅ System performs adequately under normal load
- ✅ Console logs provide clear debugging information
- ✅ UI is responsive and works across browsers

## Post-Deployment Verification

After deploying to production:

1. **Day 1**: Monitor logs for any errors
2. **Day 2-3**: Verify metrics accuracy with sample of orders
3. **Week 1**: Check for any user-reported issues
4. **Week 2**: Review cancellation tracking patterns
5. **Month 1**: Analyze performance metrics

## Maintenance and Monitoring

### Daily Checks
- Monitor error logs for `[Error]` and `[Warning]` entries
- Check for unusual patterns in cancellation rates
- Verify metrics are updating correctly

### Weekly Checks
- Review performance metrics
- Check for any authentication issues
- Verify timezone conversions are working correctly

### Monthly Checks
- Analyze long-term trends
- Review and optimize slow queries
- Update documentation if needed

## Conclusion

This test plan covers all critical aspects of the dashboard metrics system. Follow it systematically to ensure production readiness and maintain system reliability.

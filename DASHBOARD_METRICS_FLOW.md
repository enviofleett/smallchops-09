# Dashboard Metrics Data Flow

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser (Frontend)                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Dashboard.tsx                                                  │ │
│  │  - Manages date range state                                    │ │
│  │  - Validates user input                                        │ │
│  │  - Displays error messages                                     │ │
│  │  Log: [Dashboard] Date range changed                          │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                            │
│                          ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DateRangeSelector.tsx                                         │ │
│  │  - Provides date picker UI                                     │ │
│  │  - Handles preset selections (Today, 7 days, 30 days)        │ │
│  │  - Handles custom date selection                              │ │
│  │  Log: [DateRangeSelector] Preset changed                     │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                            │
│                          ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  reports.ts (API Layer)                                        │ │
│  │  - Validates authentication                                    │ │
│  │  - Builds API request                                         │ │
│  │  - Handles errors gracefully                                  │ │
│  │  - Uses environment variables                                 │ │
│  │  Log: [Analytics API] Calling endpoint                       │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                            │
└──────────────────────────┼────────────────────────────────────────────┘
                           │
                           │ HTTPS Request with Auth Token
                           │ GET /analytics-dashboard/daily-analytics
                           │ ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase Edge Function                            │
│                  (analytics-dashboard)                               │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  1. Receive Request                                            │ │
│  │     - Parse startDate and endDate                              │ │
│  │     - Validate date format                                     │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  2. Lagos Timezone Conversion                                  │ │
│  │     - Convert Lagos dates to UTC boundaries                    │ │
│  │     - lagosDateToUTC("2024-01-01", "00:00")                   │ │
│  │     - lagosDateToUTC("2024-01-31", "23:59")                   │ │
│  │     Log: [Lagos Timezone Debug] Querying with Lagos timezone  │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  3. Query Database (Multiple Queries in Parallel)             │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Query A: Legitimate Orders                              │ │ │
│  │  │  WHERE order_time >= startUTC                            │ │ │
│  │  │    AND order_time <= endUTC                              │ │ │
│  │  │    AND payment_status IN                                 │ │ │
│  │  │        ['paid', 'confirmed', 'completed']                │ │ │
│  │  │  Log: [Debug] Fetched X orders                          │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Query B: Cancelled Orders                               │ │ │
│  │  │  WHERE order_time >= startUTC                            │ │ │
│  │  │    AND order_time <= endUTC                              │ │ │
│  │  │    AND status = 'cancelled'                              │ │ │
│  │  │  Log: [Debug] Fetched X cancelled orders               │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Query C: Order Items (for product tracking)            │ │ │
│  │  │  WHERE order_id IN (order_ids_from_Query_A)             │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Query D: New Products                                   │ │ │
│  │  │  WHERE created_at >= startUTC                            │ │ │
│  │  │    AND created_at <= endUTC                              │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  Query E: New Customers                                  │ │ │
│  │  │  WHERE created_at >= startUTC                            │ │ │
│  │  │    AND created_at <= endUTC                              │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  4. Initialize Daily Map (Lagos Timezone)                     │ │
│  │     - Create object for each day in range                      │ │
│  │     - Set date key as YYYY-MM-DD (Lagos date)                │ │
│  │     - Initialize counters to 0                                │ │
│  │     Log: [Debug] Initialized X days in date range            │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  5. Aggregate Data by Lagos Date                              │ │
│  │                                                                 │ │
│  │  For each order:                                               │ │
│  │    1. Get UTC timestamp                                        │ │
│  │    2. Convert to Lagos date: formatLagosDate(utcDate)        │ │
│  │    3. Add to appropriate day in dailyMap                      │ │
│  │       - revenue += order.total_amount                         │ │
│  │       - orders += 1                                           │ │
│  │       - customers.add(order.customer_email)                   │ │
│  │                                                                 │ │
│  │  For each cancelled order:                                     │ │
│  │    1. Get UTC timestamp                                        │ │
│  │    2. Convert to Lagos date                                   │ │
│  │    3. cancelledOrders += 1                                    │ │
│  │                                                                 │ │
│  │  For each product:                                             │ │
│  │    1. Convert timestamp to Lagos date                         │ │
│  │    2. newProducts += 1                                        │ │
│  │                                                                 │ │
│  │  For each customer:                                            │ │
│  │    1. Convert timestamp to Lagos date                         │ │
│  │    2. newCustomerRegistrations += 1                           │ │
│  │                                                                 │ │
│  │  Log: [Debug] Aggregated X legitimate orders                 │ │
│  │  Log: [Debug] Aggregated X cancelled orders                  │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  6. Calculate Growth and Summaries                             │ │
│  │     - Calculate day-over-day growth percentages                │ │
│  │     - Find top products per day                                │ │
│  │     - Find top customers per day                               │ │
│  │     - Calculate summary totals                                 │ │
│  │     Log: [Debug] Daily analytics summary                      │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
│                           ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  7. Return JSON Response                                       │ │
│  │     {                                                           │ │
│  │       dailyData: [                                             │ │
│  │         {                                                       │ │
│  │           date: "2024-01-01",                                  │ │
│  │           revenue: 50000,                                      │ │
│  │           orders: 10,                                          │ │
│  │           cancelledOrders: 2,                                  │ │
│  │           customers: 8,                                        │ │
│  │           newProducts: 1,                                      │ │
│  │           newCustomerRegistrations: 3,                         │ │
│  │           topProducts: [...],                                  │ │
│  │           topCustomers: [...],                                 │ │
│  │           growth: 5.2,                                         │ │
│  │           growthDirection: "up"                                │ │
│  │         },                                                      │ │
│  │         ...                                                     │ │
│  │       ],                                                        │ │
│  │       summary: {                                               │ │
│  │         totalDays: 31,                                         │ │
│  │         totalRevenue: 1500000,                                 │ │
│  │         totalOrders: 300,                                      │ │
│  │         totalCancelledOrders: 45,                              │ │
│  │         totalCustomers: 150,                                   │ │
│  │         averageDailyRevenue: 48387,                            │ │
│  │         averageDailyOrders: 9.7                                │ │
│  │       }                                                         │ │
│  │     }                                                           │ │
│  └────────────────────────┬───────────────────────────────────────┘ │
│                           │                                           │
└───────────────────────────┼───────────────────────────────────────────┘
                           │
                           │ JSON Response
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         User Browser (Frontend)                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  reports.ts (API Layer)                                        │ │
│  │  - Receives response                                           │ │
│  │  - Validates data structure                                    │ │
│  │  - Returns to React Query                                      │ │
│  │  Log: [Analytics API] Received data structure                │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                            │
│                          ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Dashboard.tsx                                                 │ │
│  │  - Receives data via React Query                               │ │
│  │  - Updates state                                               │ │
│  │  - Passes to DailyMetricsPanel                                │ │
│  └───────────────────────┬────────────────────────────────────────┘ │
│                          │                                            │
│                          ▼                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  DailyMetricsPanel.tsx                                         │ │
│  │  - Validates and sanitizes data                                │ │
│  │  - Formats for display                                         │ │
│  │  - Renders charts and metrics                                  │ │
│  │  - Shows completed vs cancelled orders                         │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    User Sees                                    │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  📊 Summary Cards                                         │ │ │
│  │  │  - Orders: 10 (2 cancelled)                               │ │ │
│  │  │  - New Products: 1                                        │ │ │
│  │  │  - New Customers: 3                                       │ │ │
│  │  │  - Revenue: ₦50,000                                       │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  📈 Charts                                                │ │ │
│  │  │  - Orders Trend (Completed vs Cancelled)                 │ │ │
│  │  │  - Product Additions                                      │ │ │
│  │  │  - Customer Growth                                        │ │ │
│  │  │  - Revenue Trend                                          │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Lagos Timezone Conversion Detail

```
┌─────────────────────────────────────────────────────────────────┐
│  Lagos Date Input: "2024-01-15"                                 │
│  Time: "00:00"                                                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Parse as Lagos Time                                            │
│  2024-01-15 00:00:00 (Africa/Lagos, UTC+1)                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Convert to UTC                                                 │
│  Subtract 1 hour                                                │
│  Result: 2024-01-14T23:00:00.000Z                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Query Database                                                 │
│  WHERE order_time >= '2024-01-14T23:00:00.000Z'               │
│    AND order_time <= '2024-01-15T22:59:59.999Z'               │
│  (This captures all of 2024-01-15 in Lagos time)              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  For Each Order Retrieved                                       │
│  1. Get UTC timestamp: "2024-01-15T10:30:00.000Z"             │
│  2. Add Lagos offset (+1 hour): "2024-01-15T11:30:00"         │
│  3. Extract date part: "2024-01-15"                            │
│  4. Add to dailyMap["2024-01-15"]                              │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User Action → Error Occurs                                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Authentication Error?                                          │
│  ├─ Yes → Check type:                                           │
│  │  ├─ Session expired → "Refresh page or log in again"        │
│  │  ├─ 401 → "Authentication failed"                           │
│  │  └─ 403 → "Access denied"                                   │
│  └─ No → Continue to other checks                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Server Error?                                                  │
│  ├─ Yes → "Server error. Try again later."                     │
│  └─ No → Continue to other checks                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Network Error?                                                 │
│  ├─ Yes → "Check connection and try again"                     │
│  └─ No → Generic error message                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  Display Error UI                                               │
│  - Show error message                                           │
│  - Show "Retry" button                                          │
│  - Show "Refresh Page" button (if session error)               │
│  - Log error details to console                                │
└─────────────────────────────────────────────────────────────────┘
```

## Key Improvements Summary

### Before
- ❌ Only counted orders with payment_status = 'paid'
- ❌ No visibility into cancellations
- ❌ Limited timezone logging
- ❌ Generic error messages
- ❌ Hardcoded production URLs

### After
- ✅ Counts all legitimate payment statuses
- ✅ Separate cancellation tracking and display
- ✅ Comprehensive Lagos timezone logging
- ✅ User-friendly, contextual error messages
- ✅ Environment-aware configuration
- ✅ Debug logs throughout entire pipeline

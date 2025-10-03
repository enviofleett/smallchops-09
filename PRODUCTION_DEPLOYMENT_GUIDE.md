# Dashboard Metrics - Production Deployment Guide

## Pre-Deployment Checklist

### Code Review
- [x] All changes committed to feature branch
- [x] Code follows project conventions and style
- [x] TypeScript types are properly defined
- [x] No console.logs in production code (except debug logs with prefixes)
- [x] Error handling is comprehensive

### Documentation
- [x] DASHBOARD_METRICS_AUDIT_SUMMARY.md created
- [x] DASHBOARD_METRICS_TEST_PLAN.md created
- [x] This deployment guide created
- [x] Code comments explain timezone handling
- [x] JSDoc documentation for complex functions

### Environment Configuration
- [ ] Verify VITE_SUPABASE_URL is set in production
- [ ] Verify VITE_SUPABASE_ANON_KEY is set in production
- [ ] Test environment variables in staging first
- [ ] Verify Supabase Edge Functions are deployed

## Deployment Steps

### 1. Prepare for Deployment

```bash
# Ensure you're on the correct branch
git checkout copilot/fix-5df5c2b8-fc96-4bd9-afa4-dd9e0dc90210

# Pull latest changes
git pull origin copilot/fix-5df5c2b8-fc96-4bd9-afa4-dd9e0dc90210

# Review changes
git log --oneline -10
```

### 2. Build and Test Locally

```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Build the project
npm run build

# Preview the build
npm run preview
```

### 3. Deploy Backend (Supabase Edge Functions)

The `analytics-dashboard` Edge Function has been updated. Deploy it:

```bash
# Using Supabase CLI
supabase functions deploy analytics-dashboard

# Verify deployment
supabase functions list
```

Or deploy via Supabase Dashboard:
1. Go to Edge Functions section
2. Select `analytics-dashboard` function
3. Deploy the latest version
4. Verify it's running

### 4. Deploy Frontend

#### Option A: Vercel (if using)
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### Option B: Manual Build
```bash
# Build for production
npm run build:prod

# Upload dist/ folder to your hosting provider
```

#### Option C: Direct to hosting
Follow your hosting provider's deployment process for the built files in `dist/`.

### 5. Post-Deployment Verification

#### Immediate Checks (0-5 minutes)
1. **Access the Dashboard**
   - Navigate to the dashboard page
   - Verify it loads without errors

2. **Check Console Logs**
   - Open browser console
   - Look for any red errors
   - Verify you see expected logs with prefixes:
     - `[Dashboard]`
     - `[DateRangeSelector]`
     - `[Analytics API]`

3. **Test Basic Functionality**
   - View today's metrics
   - Change date range to "7 Days"
   - Change date range to "30 Days"
   - Select custom date range

4. **Verify Data Display**
   - Check order counts
   - Check cancelled orders display
   - Check revenue totals
   - Verify charts render correctly

#### Within First Hour
1. **Monitor Supabase Logs**
   ```bash
   # If using CLI
   supabase functions logs analytics-dashboard --tail
   ```
   
   Or via Dashboard:
   - Go to Edge Functions → analytics-dashboard → Logs
   - Look for:
     - `[Lagos Timezone Debug]` logs
     - `[Debug]` logs showing data fetched
     - Any `[Error]` or `[Warning]` logs

2. **Test Error Scenarios**
   - Try selecting invalid date range
   - Test with expired session (wait or manually invalidate)
   - Verify error messages are user-friendly

3. **Cross-Browser Check**
   - Test in Chrome
   - Test in Firefox
   - Test in Safari
   - Test on mobile device

#### Within First Day
1. **Data Accuracy Verification**
   - Select a specific date
   - Compare dashboard metrics with database queries
   - Verify Lagos timezone is correctly applied
   
   Example SQL query:
   ```sql
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

2. **User Feedback**
   - Monitor support channels
   - Check for any user-reported issues
   - Document any unexpected behavior

3. **Performance Monitoring**
   - Check API response times
   - Monitor Edge Function execution time
   - Verify no timeout errors

## Rollback Plan

If critical issues are discovered:

### Step 1: Immediate Rollback
```bash
# Revert to previous commit
git revert HEAD~3..HEAD  # Reverts last 3 commits

# Or restore previous version
git checkout <previous-commit-sha>

# Redeploy
npm run build
# Deploy using your method
```

### Step 2: Restore Edge Function
```bash
# Deploy previous version of edge function
supabase functions deploy analytics-dashboard --no-verify-jwt
```

### Step 3: Communicate
- Notify team of rollback
- Document the issue
- Plan fix for next deployment

## Monitoring and Alerts

### Key Metrics to Monitor

1. **Error Rate**
   - Monitor for increase in error logs
   - Set alert if error rate > 5%

2. **Response Time**
   - Analytics API should respond < 5 seconds
   - Set alert if response time > 10 seconds

3. **User Sessions**
   - Monitor authentication errors
   - Alert on spike in session failures

4. **Data Accuracy**
   - Periodic spot checks against database
   - Alert on large discrepancies

### Log Monitoring

Set up log aggregation to watch for:

**Error Patterns:**
```
[Error] Failed to fetch orders
[Error] Failed to process order
[Auth Error] Session retrieval failed
```

**Warning Patterns:**
```
[Warning] Failed to fetch cancelled orders
[Auth Warning] No active session found
```

**Success Patterns (should be common):**
```
[Debug] Fetched X orders with legitimate payment status
[Debug] Aggregated X legitimate orders
[Lagos Timezone Debug] Querying with Lagos timezone
```

## Troubleshooting Common Issues

### Issue: "No active session" error
**Cause**: Session expired or not properly initialized
**Solution**: 
- User should refresh page
- Check auth configuration
- Verify session persistence settings

**Prevention**: Implemented "Refresh Page" button in error UI

### Issue: Wrong order counts
**Cause**: Timezone conversion issue or payment status filter
**Solution**:
- Check `[Lagos Timezone Debug]` logs
- Verify UTC to Lagos conversion
- Check payment_status values in database

**Prevention**: Enhanced logging shows exact conversions

### Issue: Cancelled orders not showing
**Cause**: Database query or aggregation issue
**Solution**:
- Check `[Debug] Fetched X cancelled orders` log
- Verify orders table has status='cancelled' entries
- Check chart rendering

**Prevention**: Separate query for cancelled orders with error handling

### Issue: Date picker not updating metrics
**Cause**: Date validation or API call failure
**Solution**:
- Check console for validation errors
- Look for `[DateRangeSelector]` logs
- Verify `[Analytics API]` call succeeded

**Prevention**: Added comprehensive validation and logging

### Issue: Charts not rendering
**Cause**: Data format issue or library problem
**Solution**:
- Check if dailyData array is populated
- Verify data structure matches DailyMetric interface
- Check for JavaScript errors in console

**Prevention**: Added data validation in DailyMetricsPanel

## Performance Optimization Tips

If performance issues arise:

1. **Reduce Date Range**
   - Implement maximum date range (e.g., 90 days)
   - Paginate large datasets

2. **Add Caching**
   - Increase staleTime in React Query
   - Implement server-side caching

3. **Database Optimization**
   - Add indexes on order_time column
   - Consider materialized views for aggregations

4. **Frontend Optimization**
   - Lazy load charts
   - Virtualize long lists
   - Implement progressive loading

## Success Indicators

Deployment is successful when:

- ✅ Dashboard loads without errors
- ✅ All date range presets work correctly
- ✅ Custom date selection works
- ✅ Order counts are accurate (verified against database)
- ✅ Cancelled orders are displayed separately
- ✅ Charts render correctly
- ✅ Error messages are user-friendly
- ✅ Authentication errors are handled gracefully
- ✅ Console logs show expected patterns
- ✅ No increase in error rate
- ✅ Response times are acceptable
- ✅ Cross-browser compatibility confirmed
- ✅ Mobile responsiveness verified

## Long-term Maintenance

### Weekly Tasks
- Review error logs
- Check for any unusual patterns
- Verify data accuracy with spot checks

### Monthly Tasks
- Review performance metrics
- Update documentation if needed
- Check for library updates
- Review user feedback

### Quarterly Tasks
- Comprehensive audit of metrics accuracy
- Performance optimization review
- User experience assessment
- Consider new features or improvements

## Support Contacts

For issues or questions:
- **Technical Lead**: [Name/Email]
- **DevOps**: [Name/Email]
- **Product Owner**: [Name/Email]

## Additional Resources

- [DASHBOARD_METRICS_AUDIT_SUMMARY.md](./DASHBOARD_METRICS_AUDIT_SUMMARY.md) - Complete change documentation
- [DASHBOARD_METRICS_TEST_PLAN.md](./DASHBOARD_METRICS_TEST_PLAN.md) - Detailed testing procedures
- Supabase Dashboard: https://app.supabase.com/
- Project Repository: [GitHub URL]

## Approval Sign-off

Before deploying to production, obtain approval from:

- [ ] Technical Lead
- [ ] QA Team
- [ ] Product Owner
- [ ] DevOps Team

**Deployment Date**: _________________
**Deployed By**: _________________
**Approved By**: _________________
**Production URL**: _________________

---

**Note**: This guide should be updated as new issues are discovered or processes change. Keep it as a living document for the team.

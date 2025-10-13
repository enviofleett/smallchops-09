# SECURITY AUDIT TEST PLAN
## Validation of RLS Policies, UI Guards, and Authentication Logic

**Date:** October 13, 2025  
**Migration:** 20251013123900_security_audit_fixes.sql  
**Purpose:** Verify security fixes work correctly in production

---

## TEST ENVIRONMENT SETUP

### Prerequisites
1. Migration applied: `20251013123900_security_audit_fixes.sql`
2. Test users created:
   - Admin user (with active role in user_roles)
   - Customer user (with customer_account entry)
   - Regular user (no special privileges)

### Test Data Requirements
- At least 2 customer accounts with orders
- At least 1 admin user with active role
- Test orders with different customer_ids

---

## 1. DATABASE RLS POLICY TESTS

### Test 1.1: user_roles Self-Read Policy

**Objective:** Verify users can read their own roles

**SQL Test:**
```sql
-- Set session as regular user
SET LOCAL "request.jwt.claims" = '{"sub": "<test_user_id>"}';

-- Should succeed and return user's own roles
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Should return empty (not fail) - cannot see other users' roles
SELECT * FROM user_roles WHERE user_id != auth.uid();
```

**Expected Results:**
- ✅ Query returns own roles
- ✅ Query returns empty set for other users (not error)
- ✅ No permission denied errors

**Failure Criteria:**
- ❌ Permission denied when reading own roles
- ❌ Can see other users' roles

---

### Test 1.2: user_permissions Self-Read Policy

**Objective:** Verify users can read their own permissions

**SQL Test:**
```sql
-- Set session as regular user
SET LOCAL "request.jwt.claims" = '{"sub": "<test_user_id>"}';

-- Should succeed and return user's own permissions
SELECT * FROM user_permissions WHERE user_id = auth.uid();

-- Should return empty (not fail) - cannot see other users' permissions
SELECT * FROM user_permissions WHERE user_id != auth.uid();
```

**Expected Results:**
- ✅ Query returns own permissions
- ✅ Query returns empty set for other users
- ✅ No permission denied errors

---

### Test 1.3: is_admin() Function Reliability

**Objective:** Verify is_admin() works correctly with new policies

**SQL Test:**
```sql
-- Test as admin user
SET LOCAL "request.jwt.claims" = '{"sub": "<admin_user_id>"}';
SELECT is_admin(); -- Should return true

-- Test as customer user
SET LOCAL "request.jwt.claims" = '{"sub": "<customer_user_id>"}';
SELECT is_admin(); -- Should return false

-- Test as super admin (toolbuxdev@gmail.com)
SET LOCAL "request.jwt.claims" = '{"sub": "<super_admin_user_id>"}';
SELECT is_admin(); -- Should return true
```

**Expected Results:**
- ✅ Returns true for admin users
- ✅ Returns false for customer users
- ✅ Returns true for super admin
- ✅ No errors or timeouts

---

### Test 1.4: Customer Data Isolation - Orders

**Objective:** Verify customers can only see their own orders

**SQL Test:**
```sql
-- Set session as customer A
SET LOCAL "request.jwt.claims" = '{"sub": "<customer_a_id>"}';

-- Should return only customer A's orders
SELECT COUNT(*) FROM orders WHERE customer_id = auth.uid();

-- Should return 0 - cannot see customer B's orders
SELECT COUNT(*) FROM orders WHERE customer_id = '<customer_b_id>';

-- Should return only own orders
SELECT * FROM orders;
```

**Expected Results:**
- ✅ Can see own orders only
- ✅ Cannot see other customers' orders
- ✅ Total count matches own orders

**Failure Criteria:**
- ❌ Can see orders from other customers
- ❌ Can modify other customers' orders

---

### Test 1.5: Customer Data Isolation - customer_accounts

**Objective:** Verify customers can only see their own account

**SQL Test:**
```sql
-- Set session as customer A
SET LOCAL "request.jwt.claims" = '{"sub": "<customer_a_id>"}';

-- Should return only own account
SELECT * FROM customer_accounts WHERE user_id = auth.uid();

-- Should return empty
SELECT * FROM customer_accounts WHERE user_id != auth.uid();
```

**Expected Results:**
- ✅ Can see own account
- ✅ Cannot see other accounts
- ✅ Can update own account

---

### Test 1.6: Admin Access to All Customer Data

**Objective:** Verify admins can see all customer data

**SQL Test:**
```sql
-- Set session as admin
SET LOCAL "request.jwt.claims" = '{"sub": "<admin_user_id>"}';

-- Should return all customers
SELECT COUNT(*) FROM customers;

-- Should return all orders
SELECT COUNT(*) FROM orders;

-- Should return all customer accounts
SELECT COUNT(*) FROM customer_accounts;
```

**Expected Results:**
- ✅ Can see all customers
- ✅ Can see all orders
- ✅ Can see all customer accounts
- ✅ Can modify all customer data

---

## 2. UI ROUTE GUARD TESTS

### Test 2.1: Admin Route Protection

**Objective:** Verify customer cannot access admin routes

**Test Steps:**
1. Log in as customer
2. Navigate to `/admin/orders`
3. Observe redirect

**Expected Results:**
- ✅ Redirected to customer auth page
- ✅ No admin content visible
- ✅ Browser URL shows customer page

**Test URLs:**
- `/admin/orders`
- `/admin/delivery`
- `/dashboard`
- `/customers`
- `/settings`

---

### Test 2.2: Customer Route Protection

**Objective:** Verify admin cannot access customer routes

**Test Steps:**
1. Log in as admin
2. Navigate to `/customer/portal`
3. Observe redirect

**Expected Results:**
- ✅ Redirected to admin dashboard
- ✅ No customer portal content visible
- ✅ Browser URL shows admin page

---

### Test 2.3: Sidebar Menu Filtering

**Objective:** Verify sidebar shows only authorized items

**Test Steps:**
1. Log in as customer
2. Check visible menu items
3. Log out
4. Log in as admin
5. Check visible menu items

**Expected Results for Customer:**
- ✅ No admin menu items visible
- ✅ Customer-specific items visible
- ✅ No "Delivery Management" option
- ✅ No "Admin Users" option

**Expected Results for Admin:**
- ✅ All admin menu items visible
- ✅ Menu filtered by permissions
- ✅ No customer-only items

---

### Test 2.4: Direct URL Access

**Objective:** Verify route guards block direct URL access

**Test Steps:**
1. Log in as customer
2. Manually enter `/admin/orders` in browser
3. Press Enter
4. Observe redirect

**Expected Results:**
- ✅ Immediately redirected
- ✅ No admin content flashes
- ✅ Redirect preserves state

---

## 3. AUTHENTICATION CLASSIFICATION TESTS

### Test 3.1: New User Classification - Admin Email

**Objective:** Verify admin emails create admin accounts

**Test Steps:**
1. Register with email: `test@admin.com`
2. Complete registration
3. Check user type

**Expected Results:**
- ✅ Profile created in profiles table
- ✅ userType set to 'admin'
- ✅ No customer_account created
- ✅ Redirected to /dashboard

---

### Test 3.2: New User Classification - Regular Email

**Objective:** Verify regular emails create customer accounts

**Test Steps:**
1. Register with email: `customer@test.com`
2. Complete registration
3. Check user type

**Expected Results:**
- ✅ customer_account created
- ✅ userType set to 'customer'
- ✅ No profile created
- ✅ Redirected to /

---

### Test 3.3: Google OAuth Classification

**Objective:** Verify Google OAuth users become customers

**Test Steps:**
1. Click "Sign in with Google"
2. Complete OAuth flow
3. Check user type

**Expected Results:**
- ✅ customer_account created
- ✅ userType set to 'customer'
- ✅ No admin privileges
- ✅ Cannot access admin routes

---

### Test 3.4: Session Persistence

**Objective:** Verify session maintains user type

**Test Steps:**
1. Log in as admin
2. Refresh page
3. Check user type maintained
4. Log out
5. Log in as customer
6. Refresh page
7. Check user type maintained

**Expected Results:**
- ✅ Admin type persists across refreshes
- ✅ Customer type persists across refreshes
- ✅ No type confusion after logout/login

---

## 4. PERMISSION SYSTEM TESTS

### Test 4.1: Permission-Based Access

**Objective:** Verify permissions control feature access

**Test Steps:**
1. Log in as support_officer (limited permissions)
2. Try to access Settings
3. Try to access Orders

**Expected Results:**
- ✅ Cannot access Settings (no permission)
- ✅ Can access Orders (has permission)
- ✅ Menu shows only authorized items

---

### Test 4.2: Role-Based Permissions

**Objective:** Verify different roles have different permissions

**Test Steps:**
1. Check super_admin permissions
2. Check admin permissions
3. Check support_officer permissions

**Expected Results:**
- ✅ super_admin has all permissions
- ✅ admin has most permissions
- ✅ support_officer has limited permissions

---

## 5. PRODUCTION VALIDATION

### Test 5.1: Audit Logging

**Objective:** Verify security events are logged

**SQL Test:**
```sql
-- Check audit log for security fixes
SELECT * FROM audit_logs
WHERE action = 'security_audit_fixes_applied'
ORDER BY created_at DESC
LIMIT 1;

-- Check for customer data access logs
SELECT * FROM audit_logs
WHERE category = 'Customer Data Security'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ Security fix entry exists
- ✅ Customer data access logged
- ✅ Timestamps accurate

---

### Test 5.2: Performance Check

**Objective:** Verify new policies don't impact performance

**Test Steps:**
1. Log in as customer
2. Load orders page
3. Measure load time
4. Log in as admin
5. Load orders page
6. Measure load time

**Expected Results:**
- ✅ Customer orders load < 1 second
- ✅ Admin orders load < 2 seconds
- ✅ No noticeable degradation

---

### Test 5.3: Error Handling

**Objective:** Verify errors are handled gracefully

**Test Steps:**
1. Try to access protected resource as customer
2. Try to modify another customer's data
3. Check error messages

**Expected Results:**
- ✅ Clear error messages
- ✅ No stack traces shown
- ✅ Graceful redirect
- ✅ Audit log entry created

---

## 6. REGRESSION TESTS

### Test 6.1: Existing Functionality

**Objective:** Verify existing features still work

**Test Checklist:**
- ✅ Customer can place orders
- ✅ Admin can view orders
- ✅ Admin can assign drivers
- ✅ Customer can view order history
- ✅ Payment processing works
- ✅ Email notifications sent

---

### Test 6.2: Admin Workflows

**Objective:** Verify admin workflows unaffected

**Test Checklist:**
- ✅ Create new product
- ✅ Update order status
- ✅ Assign delivery
- ✅ View reports
- ✅ Manage customers
- ✅ Access settings

---

## 7. SECURITY PENETRATION TESTS

### Test 7.1: SQL Injection Attempts

**Objective:** Verify RLS protects against SQL injection

**Test Steps:**
1. Try injecting SQL in order queries
2. Try bypassing RLS with crafted queries

**Expected Results:**
- ✅ Injection attempts fail
- ✅ RLS policies hold
- ✅ No data leakage

---

### Test 7.2: Privilege Escalation Attempts

**Objective:** Verify customers cannot escalate privileges

**Test Steps:**
1. Log in as customer
2. Try to modify user_roles directly
3. Try to access admin API endpoints

**Expected Results:**
- ✅ Cannot modify roles
- ✅ API endpoints blocked
- ✅ Audit log entry created

---

## 8. ROLLBACK PLAN

### If Tests Fail

1. **Identify failing test**
2. **Document specific failure**
3. **Rollback migration:**
   ```sql
   -- Rollback security audit fixes
   DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
   DROP POLICY IF EXISTS "Users can view their own permissions" ON user_permissions;
   DROP POLICY IF EXISTS "Admins can manage all customer accounts" ON customer_accounts;
   ```
4. **Investigate root cause**
5. **Prepare updated migration**
6. **Re-test in staging**

---

## 9. SIGN-OFF CHECKLIST

### Database Security
- [ ] All RLS tests passed
- [ ] is_admin() function works correctly
- [ ] Customer data isolated
- [ ] Admin access verified

### UI Security
- [ ] Route guards working
- [ ] Menu filtering correct
- [ ] No unauthorized access

### Authentication
- [ ] User classification correct
- [ ] Session persistence works
- [ ] Google OAuth restricted

### Performance
- [ ] No performance degradation
- [ ] Queries execute quickly
- [ ] No timeout issues

### Regression
- [ ] Existing features work
- [ ] No breaking changes
- [ ] Admin workflows functional

---

## 10. POST-DEPLOYMENT MONITORING

### Metrics to Watch (First 24 Hours)

1. **Error Rates:**
   - Monitor for "permission denied" errors
   - Check authentication failures
   - Watch for RLS query failures

2. **Performance:**
   - Query execution times
   - Page load times
   - API response times

3. **Audit Logs:**
   - Unauthorized access attempts
   - Customer data access patterns
   - Admin action frequency

4. **User Reports:**
   - Cannot access features
   - Unexpected redirects
   - Permission errors

---

## TEST EXECUTION LOG

### Test Run: [Date/Time]
**Tester:** _______________  
**Environment:** Production/Staging  
**Migration Applied:** Yes/No

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| 1.1 | user_roles Self-Read | ⬜ Pass / ⬜ Fail | |
| 1.2 | user_permissions Self-Read | ⬜ Pass / ⬜ Fail | |
| 1.3 | is_admin() Reliability | ⬜ Pass / ⬜ Fail | |
| 1.4 | Customer Data Isolation - Orders | ⬜ Pass / ⬜ Fail | |
| 1.5 | Customer Data Isolation - Accounts | ⬜ Pass / ⬜ Fail | |
| 1.6 | Admin Access All Data | ⬜ Pass / ⬜ Fail | |
| 2.1 | Admin Route Protection | ⬜ Pass / ⬜ Fail | |
| 2.2 | Customer Route Protection | ⬜ Pass / ⬜ Fail | |
| 2.3 | Sidebar Menu Filtering | ⬜ Pass / ⬜ Fail | |
| 2.4 | Direct URL Access | ⬜ Pass / ⬜ Fail | |
| 3.1 | Admin Email Classification | ⬜ Pass / ⬜ Fail | |
| 3.2 | Customer Email Classification | ⬜ Pass / ⬜ Fail | |
| 3.3 | Google OAuth Classification | ⬜ Pass / ⬜ Fail | |
| 3.4 | Session Persistence | ⬜ Pass / ⬜ Fail | |

**Overall Result:** ⬜ PASS / ⬜ FAIL  
**Production Deployment:** ⬜ APPROVED / ⬜ REJECTED  
**Approver Signature:** _______________  
**Date:** _______________

---

**END OF TEST PLAN**

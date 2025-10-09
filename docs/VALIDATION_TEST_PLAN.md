# Validation Enhancements Test Plan

## Overview
This test plan verifies that the NULL email and role validation enhancements work correctly.

## Prerequisites
- Database migration `20251009192120_fix_null_user_roles_and_emails.sql` must be deployed
- Test environment with access to database and frontend
- Test accounts for both admin and customer roles

## Test Cases

### TC1: Customer Account with NULL Email - Auto Fix Success

**Setup**:
1. Create customer account in database with NULL email
2. Ensure corresponding auth.users record has valid email

**Steps**:
1. Attempt to log in as the customer
2. Check browser console logs

**Expected Results**:
- Console shows: `❌ Customer account missing email for user {user_id}`
- Console shows: `⚠️ Attempting to fix missing email for customer {customer_id}`
- Console shows: `✅ Successfully updated customer email to {email}`
- Console shows: `✅ Customer account validated: {email}`
- Login succeeds
- Customer can access their account

**SQL to Create Test Data**:
```sql
-- Create test user with email
INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test@example.com');

-- Create customer account without email
INSERT INTO customer_accounts (user_id, name, email) 
VALUES ((SELECT id FROM auth.users WHERE email = 'test@example.com'), 'Test Customer', NULL);
```

---

### TC2: Customer Account with NULL Email - Auto Fix Fails

**Setup**:
1. Create customer account with NULL email
2. Ensure auth.users also has NULL email

**Steps**:
1. Attempt to log in
2. Check error message

**Expected Results**:
- Console shows: `❌ Customer account missing email for user {user_id}`
- Console shows error: `Customer account is missing email. Please contact support.`
- Login fails
- User sees error message

---

### TC3: Customer Account with Invalid Email Format

**Setup**:
1. Create customer account with invalid email format (e.g., "notanemail")

**Steps**:
1. Attempt to log in
2. Check console logs

**Expected Results**:
- Console shows: `❌ Invalid email format for customer {customer_id}: notanemail`
- Error thrown: "Customer account has invalid email format"
- Login fails

**SQL to Create Test Data**:
```sql
UPDATE customer_accounts 
SET email = 'notanemail' 
WHERE id = 'test-customer-id';
```

---

### TC4: Customer Signup with Invalid Email

**Setup**:
- Navigate to customer signup page

**Steps**:
1. Enter invalid email (e.g., "test@", "test", "test.com")
2. Enter other required fields
3. Submit form

**Expected Results**:
- Console shows: `❌ Sign up failed: Invalid email format`
- Toast notification: "Registration failed - Please provide a valid email address"
- Signup does not proceed
- User remains on signup page

---

### TC5: Customer Signup with Valid Email

**Setup**:
- Navigate to customer signup page

**Steps**:
1. Enter valid email (e.g., "test@example.com")
2. Enter other required fields
3. Submit form

**Expected Results**:
- Console shows: `✅ Attempting customer signup with email: test@example.com`
- Console shows: `✅ Creating customer account with email: test@example.com`
- Signup succeeds
- Verification email sent (if configured)

---

### TC6: Admin User with NULL Role

**Setup**:
1. Create admin profile
2. Create user_roles entry with NULL role

**Steps**:
1. Attempt to log in as admin
2. Check console logs
3. Attempt to access admin dashboard

**Expected Results**:
- Console shows: `❌ User role is NULL for user {user_id} ({email}). This is a data integrity issue.`
- Console shows: `⚠️ This user will have restricted access until a valid role is assigned.`
- Console shows: `❌ Permission denied for {menu}: No user role found`
- Access blocked to admin areas
- Error screen shows: "Account Configuration Error"
- Error screen shows: "Error Code: NULL_ROLE"

**SQL to Create Test Data**:
```sql
-- Create user_roles entry with NULL role
INSERT INTO user_roles (user_id, role, is_active)
VALUES ('existing-admin-user-id', NULL, true);
```

---

### TC7: Admin User with Valid Role

**Setup**:
- Existing admin user with valid role in user_roles

**Steps**:
1. Log in as admin
2. Check console logs
3. Access admin dashboard

**Expected Results**:
- Console shows: `✅ User role fetched from user_roles table: {role} for user {user_id}`
- Login succeeds
- Can access admin dashboard
- Permissions work based on role

---

### TC8: AuthGuard - Customer with NULL Email

**Setup**:
1. Customer account with NULL email
2. User is authenticated

**Steps**:
1. Navigate to protected customer route
2. Check error screen

**Expected Results**:
- Console shows: `❌ Customer account is missing email - blocking access`
- Error screen displayed
- Shows: "Account Configuration Error"
- Shows: "Error Code: MISSING_EMAIL"
- Provides support instructions

---

### TC9: ProductionAuthGuard - Admin with NULL Role

**Setup**:
1. Admin user with NULL role
2. User is authenticated

**Steps**:
1. Navigate to protected admin route
2. Check error screen

**Expected Results**:
- Error screen displayed
- Shows: "Account Configuration Error"
- Shows: "Your account is missing a required role assignment"
- Shows: "Error Code: NULL_ROLE | User ID: {user_id}"
- Return to Store button available

---

### TC10: Email Validation in Customer Account Creation

**Setup**:
- User authenticated via OAuth with no email

**Steps**:
1. System attempts to create customer account
2. Check error handling

**Expected Results**:
- Console shows: `❌ Cannot create customer account: user has no email`
- Error logged via logger
- Error thrown: "Cannot create customer account: email is required"
- Account creation fails

---

## Database Verification Queries

### Check for NULL Emails
```sql
-- Should return 0 after migration and fixes
SELECT COUNT(*) FROM customer_accounts WHERE email IS NULL;

-- Show any remaining NULL emails with details
SELECT id, user_id, name, email 
FROM customer_accounts 
WHERE email IS NULL;
```

### Check for NULL Roles
```sql
-- Should return 0 after migration
SELECT COUNT(*) FROM user_roles WHERE role IS NULL;

-- Show any remaining NULL roles with details
SELECT ur.id, ur.user_id, ur.role, p.name, p.email
FROM user_roles ur
LEFT JOIN profiles p ON ur.user_id = p.id
WHERE ur.role IS NULL;
```

### Check Audit Logs
```sql
-- Check migration completion
SELECT * FROM audit_logs 
WHERE action = 'null_roles_emails_fix_complete'
ORDER BY created_at DESC;

-- Check email backfills
SELECT * FROM audit_logs 
WHERE action = 'customer_emails_backfilled'
ORDER BY created_at DESC;

-- Check role backfills
SELECT * FROM audit_logs 
WHERE action = 'user_roles_backfilled'
ORDER BY created_at DESC;

-- Check for NULL email warnings
SELECT * FROM audit_logs 
WHERE action = 'customer_email_null_warning'
ORDER BY created_at DESC;

-- Check for defaulted roles
SELECT * FROM audit_logs 
WHERE action = 'user_role_defaulted'
ORDER BY created_at DESC;
```

## Browser Console Monitoring

### Successful Customer Login
Expected logs:
```
✅ Customer account validated: user@example.com
✅ User role fetched from user_roles table: customer
```

### Successful Admin Login
Expected logs:
```
✅ User role fetched from user_roles table: admin for user {user_id}
✅ Permission granted for dashboard
```

### Failed Customer Login (NULL email)
Expected logs:
```
❌ Customer account missing email for user {user_id}
⚠️ Attempting to fix missing email for customer {customer_id}
```

### Failed Admin Access (NULL role)
Expected logs:
```
❌ User role is NULL for user {user_id} ({email}). This is a data integrity issue.
❌ Permission denied for dashboard: No user role found for user {user_id}
```

## Performance Testing

### Login Performance
- Test login time with validation enabled
- Should add <50ms to login flow
- Check that auto-fix doesn't cause timeouts

### Navigation Performance  
- Test navigation with throttling enabled
- Should reduce navigation events by ~60%
- No Chrome "Throttling navigation" warnings

## Regression Testing

### Existing Functionality
- [ ] Customer signup still works
- [ ] Admin signup still works
- [ ] Google OAuth still works
- [ ] Email login still works
- [ ] Password reset still works
- [ ] Email verification still works
- [ ] Role-based permissions still work
- [ ] Navigation between pages still works

## Success Criteria

- [ ] All test cases pass
- [ ] No NULL emails in customer_accounts (except legacy data)
- [ ] No NULL roles in user_roles
- [ ] Console logs show proper validation messages
- [ ] Error screens display correctly
- [ ] Auto-fix works when applicable
- [ ] Access is blocked when fields are NULL
- [ ] No regression in existing functionality
- [ ] No Chrome navigation warnings

## Test Environment Setup

1. Deploy database migration
2. Clear browser cache
3. Open browser console
4. Enable verbose logging
5. Prepare test accounts
6. Run test cases in order

## Rollback Plan

If tests fail:
1. Check database migration status
2. Review console logs for errors
3. Verify test data is correct
4. Check for conflicts with other changes
5. Roll back frontend changes if needed
6. Report issues with detailed logs

## Notes

- Test in multiple browsers (Chrome, Firefox, Safari)
- Test with different network conditions
- Test with and without ad blockers
- Monitor database query performance
- Check error reporting integration
- Verify logging doesn't expose sensitive data

---

**Created**: 2025-01-XX  
**Status**: Ready for execution  
**Version**: 1.0

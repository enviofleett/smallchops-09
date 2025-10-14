# User Deletion Guide

This guide documents the permanent deletion of specified users from the system.

## Users to be Deleted

The following users will be permanently removed from the system:

1. ulekeji2900@gmail.com
2. emebassey20120@gmail.com
3. toyintheophilus01@gmail.com
4. akomhelen@gmail.com
5. maryaustinokoro@gmail.com
6. account@startersmallchops.com
7. emmanuelaudokw@gmail.com
8. beenfacoo@gmail.com
9. maryqueenrita@gmail.com

## Migration Files

### 20251014134337_delete_specified_users.sql
This migration performs the actual deletion of users. It uses the existing `recover_customer_email()` function which handles:

- Deletion from `auth.users` table
- Deletion from `customer_accounts` table
- Deletion from `customers` table
- Deletion from `profiles` table
- Cleanup of `communication_events`
- Removal from `email_suppression_list`
- All cascade deletions for related data

The migration loops through each email address and calls the deletion function, logging results for each user.

### 20251014134338_verify_user_deletion.sql
This is a verification script that checks if all users have been successfully deleted. It will:

- Check `auth.users` table for any remaining entries
- Check `customers` table for any remaining entries
- Check `profiles` table for any remaining entries
- Report which users (if any) still exist
- Provide a summary of the deletion status

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended for Production)

1. Log in to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `20251014134337_delete_specified_users.sql`
4. Execute the script
5. Review the NOTICE messages in the output to confirm each user was deleted
6. Run the verification script `20251014134338_verify_user_deletion.sql` to confirm success

### Option 2: Via Supabase CLI (Local Development)

```bash
# Ensure you're in the project directory
cd /path/to/smallchops-09

# Apply the migration
supabase db push

# Or apply specific migration
supabase migration up 20251014134337_delete_specified_users.sql

# Verify deletion
supabase migration up 20251014134338_verify_user_deletion.sql
```

## Expected Output

When running the deletion script, you should see NOTICE messages like:

```
NOTICE:  Deleted user: ulekeji2900@gmail.com - Result: {"success": true, "email": "ulekeji2900@gmail.com", "message": "Email recovered and ready for re-registration"}
NOTICE:  Deleted user: emebassey20120@gmail.com - Result: {"success": true, "email": "emebassey20120@gmail.com", "message": "Email recovered and ready for re-registration"}
...
NOTICE:  User deletion completed
```

When running the verification script, you should see:

```
NOTICE:  Starting verification of user deletion...
NOTICE:  ================================================
NOTICE:  DELETED: ulekeji2900@gmail.com
NOTICE:  DELETED: emebassey20120@gmail.com
...
NOTICE:  ================================================
NOTICE:  SUCCESS: All users have been deleted
```

## Audit Trail

All deletion actions are logged in the `audit_logs` table with:
- Action: `email_recovery_completed`
- Category: `Customer Management`
- Message: Details about the deleted user
- Timestamp: When the deletion occurred

## Rollback Information

⚠️ **WARNING**: This deletion is PERMANENT and CANNOT be rolled back automatically.

The following data will be permanently lost:
- User authentication credentials
- Profile information
- Customer account details
- Order history
- Communication preferences
- Favorites and reviews

If you need to restore any of these users later, they will need to:
1. Re-register as new users
2. Set up their accounts from scratch
3. Previous order history will not be available

## Safety Measures

The migration includes:
- Exception handling for each user deletion
- Detailed logging of success and failures
- Verification script to confirm deletion
- Audit log entries for compliance

## Notes

- The `recover_customer_email()` function is designed to clean up all user data comprehensively
- Foreign key cascades ensure related data is also removed
- The function handles cases where users might not exist in all tables
- Each deletion is wrapped in a transaction for data integrity

# Validation Flow Diagrams

## Customer Email Validation Flow

### 1. Customer Login Flow

```
┌─────────────────┐
│  User Attempts  │
│  to Login       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  Auth Context Loads     │
│  Customer Account       │
└────────┬────────────────┘
         │
         ▼
    ┌────────────┐
    │ Has Email? │
    └────┬───────┘
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    │         ▼
    │    ┌─────────────────────┐
    │    │ Log Error:          │
    │    │ "Missing email"     │
    │    └─────────┬───────────┘
    │              │
    │              ▼
    │         ┌──────────────┐
    │         │ auth.users   │
    │         │ has email?   │
    │         └──────┬───────┘
    │                │
    │           ┌────┴────┐
    │           │         │
    │          Yes       No
    │           │         │
    │           │         ▼
    │           │    ┌─────────────────┐
    │           │    │ Throw Error:    │
    │           │    │ "Contact Support"│
    │           │    └─────────────────┘
    │           │
    │           ▼
    │    ┌─────────────────────┐
    │    │ Update customer     │
    │    │ email from auth     │
    │    └─────────┬───────────┘
    │              │
    │              ▼
    │    ┌─────────────────────┐
    │    │ Update Success?     │
    │    └─────────┬───────────┘
    │              │
    │         ┌────┴────┐
    │         │         │
    │        Yes       No
    │         │         │
    │         │         ▼
    │         │    ┌─────────────────┐
    │         │    │ Throw Error     │
    │         │    └─────────────────┘
    │         │
    ▼         ▼
┌─────────────────────┐
│ Validate Email      │
│ Format              │
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
  Valid    Invalid
    │         │
    │         ▼
    │    ┌─────────────────┐
    │    │ Throw Error:    │
    │    │ "Invalid Format"│
    │    └─────────────────┘
    │
    ▼
┌─────────────────────┐
│ Log Success:        │
│ "Account validated" │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Allow Login         │
└─────────────────────┘
```

### 2. Customer Signup Flow

```
┌─────────────────┐
│  User Submits   │
│  Signup Form    │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Validate Email      │
│ Format (Regex)      │
└────────┬────────────┘
         │
    ┌────┴────┐
    │         │
  Valid    Invalid
    │         │
    │         ▼
    │    ┌─────────────────┐
    │    │ Show Toast:     │
    │    │ "Invalid Email" │
    │    │ Return Error    │
    │    └─────────────────┘
    │
    ▼
┌─────────────────────┐
│ Call Supabase       │
│ auth.signUp()       │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Trigger fires:      │
│ handle_new_user()   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Insert customer     │
│ account with email  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Signup Success      │
└─────────────────────┘
```

## Admin Role Validation Flow

### 1. Admin Login Flow

```
┌─────────────────┐
│  Admin Attempts │
│  to Login       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  useRoleBasedPermissions│
│  Fetches Role           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Query user_roles table  │
│ WHERE user_id = ?       │
└────────┬────────────────┘
         │
         ▼
    ┌────────────┐
    │ Has Role?  │
    └────┬───────┘
         │
    ┌────┴────┐
    │         │
   Yes       No
    │         │
    │         ▼
    │    ┌─────────────────────┐
    │    │ Log Error:          │
    │    │ "Role is NULL"      │
    │    │ + User details      │
    │    └─────────┬───────────┘
    │              │
    │              ▼
    │         ┌──────────────┐
    │         │ Set role =   │
    │         │ null         │
    │         └──────┬───────┘
    │                │
    ▼                ▼
┌─────────────────────────┐
│ Log Success:            │
│ "Role fetched: {role}"  │
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│ User attempts to access │
│ protected route         │
└─────────┬───────────────┘
          │
          ▼
    ┌──────────────┐
    │ Has Role?    │
    └──────┬───────┘
           │
      ┌────┴────┐
      │         │
     Yes       No
      │         │
      │         ▼
      │    ┌─────────────────────┐
      │    │ ProductionAuthGuard │
      │    │ Shows Error Screen  │
      │    │ "NULL_ROLE"         │
      │    └─────────────────────┘
      │
      ▼
┌─────────────────────┐
│ hasPermission()     │
│ checks access       │
└─────────┬───────────┘
          │
     ┌────┴────┐
     │         │
   Allow     Deny
     │         │
     │         ▼
     │    ┌─────────────────┐
     │    │ Log Error:      │
     │    │ "No role found" │
     │    └─────────────────┘
     │
     ▼
┌─────────────────┐
│ Grant Access    │
└─────────────────┘
```

## Error Screen Flow

### Customer Missing Email

```
┌─────────────────────┐
│ AuthGuard Component │
│ requiredRole='customer'
└─────────┬───────────┘
          │
          ▼
    ┌──────────────────┐
    │ customerAccount  │
    │ has email?       │
    └────────┬─────────┘
             │
        ┌────┴────┐
        │         │
       Yes       No
        │         │
        │         ▼
        │    ┌─────────────────────────────┐
        │    │ Show Error Screen:          │
        │    │ ┌─────────────────────────┐ │
        │    │ │ 🚫 Account Config Error │ │
        │    │ │                         │ │
        │    │ │ Your account is missing │ │
        │    │ │ required information    │ │
        │    │ │ (email).                │ │
        │    │ │                         │ │
        │    │ │ Please contact support  │ │
        │    │ │                         │ │
        │    │ │ Error: MISSING_EMAIL    │ │
        │    │ └─────────────────────────┘ │
        │    └─────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │ Render  │
   │ Children│
   └─────────┘
```

### Admin Missing Role

```
┌─────────────────────────┐
│ ProductionAuthGuard     │
└─────────┬───────────────┘
          │
          ▼
    ┌──────────────────┐
    │ canAccessAdmin?  │
    └────────┬─────────┘
             │
        ┌────┴────┐
        │         │
       Yes       No
        │         │
        │         ▼
        │    ┌──────────────┐
        │    │ Check if     │
        │    │ NULL role?   │
        │    └────────┬─────┘
        │             │
        │        ┌────┴────┐
        │        │         │
        │       Yes       No
        │        │         │
        │        │         ▼
        │        │    ┌─────────────────┐
        │        │    │ Show generic    │
        │        │    │ "Access Denied" │
        │        │    └─────────────────┘
        │        │
        │        ▼
        │    ┌─────────────────────────────┐
        │    │ Show Error Screen:          │
        │    │ ┌─────────────────────────┐ │
        │    │ │ 🔒 Config Error         │ │
        │    │ │                         │ │
        │    │ │ Your account is missing │ │
        │    │ │ a required role         │ │
        │    │ │ assignment.             │ │
        │    │ │                         │ │
        │    │ │ Data integrity issue.   │ │
        │    │ │ Contact administrator.  │ │
        │    │ │                         │ │
        │    │ │ Error: NULL_ROLE        │ │
        │    │ │ User ID: {id}           │ │
        │    │ └─────────────────────────┘ │
        │    └─────────────────────────────┘
        │
        ▼
   ┌─────────┐
   │ Render  │
   │ Children│
   └─────────┘
```

## Auto-Fix Flow for NULL Email

```
┌──────────────────────┐
│ Customer account     │
│ loaded with NULL     │
│ email                │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Log Error:           │
│ "Missing email"      │
│ + Account details    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Check: auth.users    │
│ has email for this   │
│ user_id?             │
└──────────┬───────────┘
           │
      ┌────┴────┐
      │         │
     Yes       No
      │         │
      │         ▼
      │    ┌─────────────────┐
      │    │ Throw Error:    │
      │    │ "Missing email. │
      │    │ Contact support"│
      │    └─────────────────┘
      │
      ▼
┌──────────────────────┐
│ Log Warning:         │
│ "Attempting to fix"  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ UPDATE customer_     │
│ accounts SET email = │
│ auth.users.email     │
└──────────┬───────────┘
           │
      ┌────┴────┐
      │         │
   Success   Failure
      │         │
      │         ▼
      │    ┌─────────────────┐
      │    │ Log Error:      │
      │    │ "Failed to fix" │
      │    │ Throw Error     │
      │    └─────────────────┘
      │
      ▼
┌──────────────────────┐
│ Log Success:         │
│ "Updated email to"   │
│ + new email          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Update local         │
│ customerAcc.email    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Continue with        │
│ email validation     │
└──────────────────────┘
```

## Validation Points Summary

| Location | Validates | Action on Failure |
|----------|-----------|-------------------|
| `signUp()` | Email format | Show toast, return error |
| `signUpAdmin()` | Email format | Show toast, return error |
| `loadUserData()` - Customer | Email not NULL | Attempt auto-fix or throw |
| `loadUserData()` - Customer | Email format | Throw error |
| `loadUserData()` - Create | Email not NULL | Throw error |
| `loadUserData()` - Create | Email format | Throw error |
| `useRoleBasedPermissions` | Role not NULL | Log error, set null |
| `hasPermission()` | Role not NULL | Log error, return false |
| `AuthGuard` | Customer email | Show error screen |
| `ProductionAuthGuard` | Admin role | Show error screen |

## Console Log Legend

| Symbol | Meaning | Example |
|--------|---------|---------|
| ✅ | Success | `✅ Customer account validated: user@example.com` |
| ❌ | Error | `❌ User role is NULL for user {id}` |
| ⚠️ | Warning | `⚠️ Attempting to fix missing email` |
| 🚫 | Blocked | `🚫 Navigation throttled: Already at /path` |
| 🔐 | Security | `🔐 SUPER ADMIN ACCESS: toolbuxdev@gmail.com` |

## Integration with Database Migration

```
┌─────────────────────────────┐
│ Database Migration          │
│ 20251009192120_...sql       │
│                             │
│ • Backfill NULL emails      │
│ • Backfill NULL roles       │
│ • Add validation triggers   │
│ • Create indexes            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Frontend Validation         │
│ (This Implementation)       │
│                             │
│ • Validate on load          │
│ • Validate on create        │
│ • Auto-fix when possible    │
│ • Block access when needed  │
└─────────────────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Result:                     │
│ • Zero NULL emails          │
│ • Zero NULL roles           │
│ • Clear error messages      │
│ • Better user experience    │
└─────────────────────────────┘
```

---

**Note**: These diagrams show the complete validation flow from user action to error handling. All validation points work together to ensure data integrity and provide clear feedback to users.

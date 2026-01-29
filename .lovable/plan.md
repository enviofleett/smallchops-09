
# Plan: Grant Support Staff Access to Catering Bookings

## Summary
This plan provides the recommended approach to give "Support Staff" users access to the Catering Bookings menu and page. The current system already has a well-structured Role-Based Access Control (RBAC) implementation that makes this change straightforward.

## Current State Analysis

### Permission System Architecture
The application uses a centralized permission system in `src/hooks/useRoleBasedPermissions.ts`:

1. **Role Definitions**: All roles are defined in `ROLE_PERMISSIONS` array with menu-level permissions
2. **Permission Levels**: Each menu can have `'none'`, `'view'`, or `'edit'` access
3. **Menu Key**: Catering Bookings uses the key `catering_bookings`

### Current Support Staff Permissions
```typescript
{
  role: 'support_staff',
  permissions: {
    dashboard: 'view',
    orders_view: 'edit',
    customers_view: 'edit',
    categories_view: 'none',
    products_view: 'none',
    catering_bookings: 'none',  // Currently NO access
    delivery_zones: 'none',
    // ... other permissions
  }
}
```

### How Menu Visibility Works
The sidebar (`AppSidebar.tsx`) filters menu items based on permissions:
```typescript
const filterItems = (items: MenuItem[]) => 
  items.filter(item => hasPermission(item.permissionKey, 'view'));
```

### Route Protection
The `/bookings` route is protected by `ProtectedRoute` component which wraps all admin routes. Since Support Staff are already admin users, they can access the route—the only restriction is the menu visibility and permission checks.

---

## Recommended Implementation

### Single-File Change Approach
The best approach is a **single-line change** in `src/hooks/useRoleBasedPermissions.ts`:

**Change this:**
```typescript
catering_bookings: 'none',
```

**To one of these options:**

| Option | Permission | What Support Staff Can Do |
|--------|-----------|---------------------------|
| A | `'view'` | View bookings, filter, search (read-only) |
| B | `'edit'` | Full access: view, update status, add quotes, manage bookings |

### Recommended: Option B - Edit Access
Based on the Support Staff role purpose (handling customer inquiries and support), granting **edit access** makes the most sense because:

1. Support Staff already have `edit` access to Orders and Customers
2. Catering Bookings require similar management tasks (status updates, quotes, notes)
3. View-only access would limit their ability to respond to customer inquiries

---

## Implementation Steps

### Step 1: Update Role Permissions
**File:** `src/hooks/useRoleBasedPermissions.ts`

**Location:** Lines 59-77 (support_staff role definition)

**Change:**
```typescript
// Before (line 66)
catering_bookings: 'none',

// After
catering_bookings: 'edit',  // Grant full management access
```

### Step 2: Verify Access (No Code Changes Needed)
The following components will automatically work:

1. **Sidebar Menu** - "Catering Bookings" will appear in the Management section
2. **Route Access** - `/bookings` page will be accessible
3. **Page Functionality** - All booking management features will work

---

## Security Considerations

### Database Level (RLS)
The `catering_bookings` table should have RLS policies that allow admin users to access records. Since Support Staff are already admin users (stored in `user_roles` table), existing RLS policies using `is_admin_user()` function will grant access.

### Audit Trail
The booking management page already logs the `reviewed_by` user ID when updates are made, ensuring accountability.

---

## Alternative: View-Only Access
If you prefer Support Staff to only view bookings without editing:

```typescript
catering_bookings: 'view',
```

This would allow them to:
- See the Catering Bookings menu item
- View the bookings list and details
- But NOT update status, quotes, or notes

The "Manage" button functionality would need additional permission checks in `BookingManagement.tsx` if you want granular control.

---

## Technical Details

### Files Affected
| File | Change Type |
|------|-------------|
| `src/hooks/useRoleBasedPermissions.ts` | Line 66: Update permission value |

### No Migration Required
This is a frontend-only configuration change. No database schema or RLS policy updates are needed since:
- Support Staff are already admin users in `user_roles` table
- Existing `is_admin_user()` RLS function grants database access to all admin roles

### Testing Checklist
After implementation:
1. Log in as a Support Staff user
2. Verify "Catering Bookings" appears in sidebar under "Management"
3. Click to access `/bookings` page
4. Test viewing, filtering, and managing bookings
5. Verify changes are saved with correct `reviewed_by` user ID

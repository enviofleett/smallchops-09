# Single-Role Admin System Implementation

## Overview

This document describes the implementation of a single-role admin system with three distinct roles: `super_admin`, `manager`, and `support_officer`. The system enforces role-based access control both on the frontend and backend.

## Role Definitions

### Super Admin (`super_admin`)
- **Access**: Full access to all menus and features
- **Special Privileges**: 
  - Can register new managers and support officers
  - Can assign and modify user roles
  - Access to all settings and administrative functions
- **Email**: `toolbuxdev@gmail.com` is guaranteed super_admin access

### Manager (`manager`)
- **Access**: All pages except settings
- **Restrictions**: 
  - Cannot access settings page/menu
  - Cannot create or modify user roles
  - Cannot access administrative user management

### Support Officer (`support_officer`)
- **Access**: Dashboard and order management only
- **Restrictions**:
  - Limited to dashboard view and order management
  - Read-only access to customer information (for order context)
  - No access to products, categories, settings, or other administrative functions

## Implementation Details

### Database Schema Changes

#### 1. Role Enum Updates
```sql
-- Added new roles to existing enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'support_officer';
```

#### 2. User Invitations Table
```sql
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  name TEXT,
  invited_by UUID REFERENCES public.profiles(id),
  status public.invitation_status DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 3. Updated Trigger Function
The `handle_new_user()` function now:
- Automatically assigns `super_admin` role to `toolbuxdev@gmail.com`
- Defaults new users to `support_officer` role
- Requires invitation-based registration for privileged roles

### Frontend Implementation

#### 1. Role-Based Permission System
**File**: `src/hooks/useRoleBasedPermissions.ts`

Implements direct role-to-permission mapping:
```typescript
const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'super_admin',
    permissions: {
      'dashboard': 'edit',
      'orders': 'edit',
      'settings': 'edit',
      // ... all menus with edit access
    }
  },
  // ... other roles with restricted permissions
];
```

#### 2. Updated Authentication System
**File**: `src/hooks/useAuthStatus.ts`

- Updated to recognize new role system
- Special handling for `toolbuxdev@gmail.com`
- Proper privilege assignment based on roles

#### 3. Protected Routes
**File**: `src/components/ProtectedRoute.tsx`

- Role-based route protection
- Hierarchical access (super_admin > manager > support_officer)
- Menu-based permission checking

#### 4. User Management Interface
**File**: `src/hooks/useUserManagement.ts`

- Secure user creation through invitations
- Role assignment with proper permission checks
- User deactivation and role updates

### Backend Security

#### 1. Supabase Edge Function
**File**: `supabase/functions/role-management/index.ts`

Provides secure endpoints for:
- **POST** `/create-user-invitation`: Create time-limited user invitations
- **PUT** `/update-role`: Update user roles with proper authorization

Key security features:
- Validates requester has `super_admin` role
- Prevents self-role-removal for super_admins
- Comprehensive audit logging
- Input validation and error handling

#### 2. Row Level Security (RLS) Policies

Updated policies ensure:
- Only super_admins can view/modify user roles
- Managers can view profiles but not modify roles
- Proper isolation of user data

#### 3. Database Functions

- `is_super_admin()`: Check if current user is super admin
- `has_manager_privileges()`: Check for manager or higher privileges
- `accept_user_invitation()`: Process invitation acceptance during registration

## Menu Visibility Matrix

| Menu Item | Super Admin | Manager | Support Officer |
|-----------|-------------|---------|-----------------|
| Dashboard | ✅ Edit | ✅ Edit | ✅ View |
| Orders | ✅ Edit | ✅ Edit | ✅ Edit |
| Categories | ✅ Edit | ✅ Edit | ❌ None |
| Products | ✅ Edit | ✅ Edit | ❌ None |
| Customers | ✅ Edit | ✅ Edit | ✅ View |
| Bookings | ✅ Edit | ✅ Edit | ❌ None |
| Delivery | ✅ Edit | ✅ Edit | ❌ None |
| Promotions | ✅ Edit | ✅ Edit | ❌ None |
| Reports | ✅ Edit | ✅ Edit | ❌ None |
| Audit Logs | ✅ Edit | ✅ View | ❌ None |
| Settings | ✅ Edit | ❌ None | ❌ None |

## Security Features

### 1. Frontend Security
- Role-based menu visibility
- Route protection with role validation
- Permission-based component rendering
- Input validation and error handling

### 2. Backend Security
- Server-side role validation in Edge Functions
- RLS policies preventing unauthorized data access
- Audit logging for all administrative actions
- Time-limited invitations with automatic expiration

### 3. Special Protections
- `toolbuxdev@gmail.com` guaranteed super_admin access
- Prevention of self-role-removal for super_admins
- Secure invitation-based user creation
- Comprehensive error handling and logging

## Usage Instructions

### For Super Admins

#### Creating New Users
1. Navigate to Admin Settings
2. Click "Create User" 
3. Select appropriate role (super_admin, manager, support_officer)
4. System creates time-limited invitation
5. New user registers using invitation link

#### Managing Existing Users
1. View user list in Admin Settings
2. Update roles as needed (calls secure Edge Function)
3. Deactivate users when necessary
4. Monitor audit logs for user activities

### For Managers
- Full access to all operational functions
- Cannot access Settings or user management
- Can view audit logs but cannot modify system settings

### For Support Officers
- Limited to dashboard and order management
- Can process orders and view customer information
- No access to product management or system settings

## Testing and Validation

### Test Component
**File**: `src/components/RoleTestComponent.tsx`

Provides visual validation of:
- Current user role and permissions
- Menu access matrix
- Special privileges (role assignment)
- Real-time permission checking

### Validation Checklist
- [ ] Super admin can access all menus
- [ ] Manager cannot access settings
- [ ] Support officer limited to dashboard and orders
- [ ] Role assignment restricted to super_admins
- [ ] `toolbuxdev@gmail.com` guaranteed access
- [ ] Unauthorized access redirects properly
- [ ] Database constraints enforced
- [ ] Audit logging working correctly

## Migration Path

### From Existing System
1. Run database migrations to add new roles
2. Update existing `admin` users to `super_admin`
3. Deploy updated frontend code
4. Deploy Edge Functions for role management
5. Test all role scenarios
6. Update user documentation

### Rollback Plan
If issues arise:
1. Revert to previous role enum values
2. Update frontend to use legacy permission system
3. Disable new Edge Functions
4. Restore previous RLS policies

## Monitoring and Maintenance

### Key Metrics to Monitor
- Role assignment activities (via audit logs)
- Failed permission checks
- Invitation expiration rates
- User creation success rates

### Regular Maintenance
- Review and expire old invitations
- Audit user role assignments
- Monitor for unauthorized access attempts
- Update role permissions as business needs evolve

## Conclusion

The single-role admin system provides clear, hierarchical access control with strong security enforcement at both frontend and backend levels. The implementation ensures that each role has appropriate access to functionality while maintaining system security and audit trails.
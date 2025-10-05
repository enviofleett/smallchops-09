import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'support_officer' | 'staff';

export interface RolePermission {
  role: UserRole;
  permissions: {
    [menuKey: string]: 'none' | 'view' | 'edit';
  };
}

// Define role-based permissions according to requirements
export const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: 'super_admin',
    permissions: {
      // Super admin has access to all menus and features
      'dashboard': 'edit',
      'orders': 'edit',
      'categories': 'edit',
      'products': 'edit',
      'customers': 'edit',
      'bookings': 'edit',
      'delivery': 'edit',
      'promotions': 'edit',
      'reports': 'edit',
      'auditLogs': 'edit',
      'settings': 'edit',
      'settingsAdmin': 'edit',
      'settingsPermissions': 'edit',
      'settingsPayments': 'edit',
      'settingsCommunications': 'edit',
    }
  },
  {
    role: 'admin',
    permissions: {
      // Admin role has full access to everything
      'dashboard': 'edit',
      'orders': 'edit',
      'categories': 'edit',
      'products': 'edit',
      'customers': 'edit',
      'bookings': 'edit',
      'delivery': 'edit',
      'promotions': 'edit',
      'reports': 'edit',
      'auditLogs': 'edit',
      'settings': 'edit',
      'settingsAdmin': 'edit',
      'settingsPermissions': 'edit',
      'settingsPayments': 'edit',
      'settingsCommunications': 'edit',
    }
  },
  {
    role: 'manager',
    permissions: {
      // Manager has access to all pages except the settings page
      'dashboard': 'edit',
      'orders': 'edit',
      'categories': 'edit',
      'products': 'edit',
      'customers': 'edit',
      'bookings': 'edit',
      'delivery': 'edit',
      'promotions': 'edit',
      'reports': 'edit',
      'auditLogs': 'view',
      'settings': 'none',  // No access to settings
      'settingsAdmin': 'none',
      'settingsPermissions': 'none',
      'settingsPayments': 'none',
      'settingsCommunications': 'none',
    }
  },
  {
    role: 'support_officer',
    permissions: {
      // Support officer can access only dashboard and order management
      'dashboard': 'view',
      'orders': 'edit',  // Order management access
      'categories': 'none',
      'products': 'none',
      'customers': 'view',  // May need to view customer info for orders
      'bookings': 'none',
      'delivery': 'none',
      'promotions': 'none',
      'reports': 'none',
      'auditLogs': 'none',
      'settings': 'none',
      'settingsAdmin': 'none',
      'settingsPermissions': 'none',
      'settingsPayments': 'none',
      'settingsCommunications': 'none',
    }
  },
  {
    role: 'staff',
    permissions: {
      // Staff role has limited access - similar to support officer
      'dashboard': 'view',
      'orders': 'view',
      'categories': 'none',
      'products': 'none',
      'customers': 'view',
      'bookings': 'none',
      'delivery': 'none',
      'promotions': 'none',
      'reports': 'none',
      'auditLogs': 'none',
      'settings': 'none',
      'settingsAdmin': 'none',
      'settingsPermissions': 'none',
      'settingsPayments': 'none',
      'settingsCommunications': 'none',
    }
  }
];

export const useRoleBasedPermissions = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = React.useState<UserRole | null>(null);

  // Fetch user role from user_roles table
  React.useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) {
        setUserRole(null);
        return;
      }

      // CRITICAL PRODUCTION: Special case for toolbuxdev@gmail.com - always super_admin
      if (user.email === 'toolbuxdev@gmail.com') {
        console.log('🔐 SUPER ADMIN ACCESS: toolbuxdev@gmail.com detected, granting super_admin role');
        setUserRole('super_admin');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('role', { ascending: true }) // super_admin first
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          setUserRole(null);
          return;
        }

        const fetchedRole = data?.role as UserRole || null;
        console.log(`✅ User role fetched from user_roles table: ${fetchedRole} for user ${user.id}`);
        setUserRole(fetchedRole);
      } catch (err) {
        console.error('Error fetching user role:', err);
        setUserRole(null);
      }
    };

    fetchUserRole();
  }, [user?.id, user?.email]);

  const hasPermission = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    // CRITICAL: Special case for toolbuxdev@gmail.com - always has access
    if (user?.email === 'toolbuxdev@gmail.com') {
      console.log(`✅ Permission granted for ${menuKey} (super admin: toolbuxdev@gmail.com)`);
      return true;
    }

    if (!userRole) {
      console.log(`❌ Permission denied for ${menuKey}: No user role found`);
      return false;
    }

    const rolePermission = ROLE_PERMISSIONS.find(rp => rp.role === userRole);
    if (!rolePermission) return false;

    const permission = rolePermission.permissions[menuKey];
    if (!permission || permission === 'none') return false;

    // Check if user has required permission level
    if (requiredLevel === 'edit' && permission !== 'edit') return false;
    
    return true;
  };

  const canCreateUsers = (): boolean => {
    return userRole === 'super_admin' || userRole === 'admin' || user?.email === 'toolbuxdev@gmail.com';
  };

  const canAssignRoles = (): boolean => {
    return userRole === 'super_admin' || userRole === 'admin' || user?.email === 'toolbuxdev@gmail.com';
  };

  const getAccessibleMenus = (): string[] => {
    if (!userRole) return [];

    // Special case for toolbuxdev@gmail.com - all menus
    if (user?.email === 'toolbuxdev@gmail.com') {
      return Object.keys(ROLE_PERMISSIONS[0].permissions);
    }

    const rolePermission = ROLE_PERMISSIONS.find(rp => rp.role === userRole);
    if (!rolePermission) return [];

    return Object.entries(rolePermission.permissions)
      .filter(([_, permission]) => permission !== 'none')
      .map(([menuKey, _]) => menuKey);
  };

  return {
    userRole,
    hasPermission,
    canCreateUsers,
    canAssignRoles,
    getAccessibleMenus,
  };
};
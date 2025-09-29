import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'super_admin' | 'manager' | 'support_officer' | 'admin';

export interface RolePermission {
  role: UserRole;
  permissions: {
    [menuKey: string]: 'none' | 'view' | 'edit';
  };
}

// Define role-based permissions according to requirements
const ROLE_PERMISSIONS: RolePermission[] = [
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
  }
];

export const useRoleBasedPermissions = () => {
  const { user } = useAuth();

  const getUserRole = (): UserRole | null => {
    if (!user) return null;
    
    // Special case for toolbuxdev@gmail.com - always super_admin
    if (user.email === 'toolbuxdev@gmail.com') {
      return 'super_admin';
    }
    
    return user.role as UserRole || 'support_officer';
  };

  const hasPermission = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    const userRole = getUserRole();
    if (!userRole) return false;

    // Special case for toolbuxdev@gmail.com - always has access
    if (user?.email === 'toolbuxdev@gmail.com') {
      return true;
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
    const userRole = getUserRole();
    return userRole === 'super_admin' || userRole === 'admin' || user?.email === 'toolbuxdev@gmail.com';
  };

  const canAssignRoles = (): boolean => {
    const userRole = getUserRole();
    return userRole === 'super_admin' || userRole === 'admin' || user?.email === 'toolbuxdev@gmail.com';
  };

  const getAccessibleMenus = (): string[] => {
    const userRole = getUserRole();
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
    userRole: getUserRole(),
    hasPermission,
    canCreateUsers,
    canAssignRoles,
    getAccessibleMenus,
  };
};
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, UserRoleType, PermissionLevel, RolePermission } from '@/types/auth';

// Define role-based permissions according to requirements
const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: UserRole.SUPER_ADMIN,
    permissions: {
      // Super admin has access to all menus and features
      'dashboard': PermissionLevel.EDIT,
      'orders': PermissionLevel.EDIT,
      'categories': PermissionLevel.EDIT,
      'products': PermissionLevel.EDIT,
      'customers': PermissionLevel.EDIT,
      'bookings': PermissionLevel.EDIT,
      'delivery': PermissionLevel.EDIT,
      'promotions': PermissionLevel.EDIT,
      'reports': PermissionLevel.EDIT,
      'auditLogs': PermissionLevel.EDIT,
      'settings': PermissionLevel.EDIT,
      'settingsAdmin': PermissionLevel.EDIT,
      'settingsPermissions': PermissionLevel.EDIT,
      'settingsPayments': PermissionLevel.EDIT,
      'settingsCommunications': PermissionLevel.EDIT,
    }
  },
  {
    role: UserRole.ADMIN,
    permissions: {
      // Admin role has full access to everything
      'dashboard': PermissionLevel.EDIT,
      'orders': PermissionLevel.EDIT,
      'categories': PermissionLevel.EDIT,
      'products': PermissionLevel.EDIT,
      'customers': PermissionLevel.EDIT,
      'bookings': PermissionLevel.EDIT,
      'delivery': PermissionLevel.EDIT,
      'promotions': PermissionLevel.EDIT,
      'reports': PermissionLevel.EDIT,
      'auditLogs': PermissionLevel.EDIT,
      'settings': PermissionLevel.EDIT,
      'settingsAdmin': PermissionLevel.EDIT,
      'settingsPermissions': PermissionLevel.EDIT,
      'settingsPayments': PermissionLevel.EDIT,
      'settingsCommunications': PermissionLevel.EDIT,
    }
  },
  {
    role: UserRole.MANAGER,
    permissions: {
      // Manager has access to all pages except the settings page
      'dashboard': PermissionLevel.EDIT,
      'orders': PermissionLevel.EDIT,
      'categories': PermissionLevel.EDIT,
      'products': PermissionLevel.EDIT,
      'customers': PermissionLevel.EDIT,
      'bookings': PermissionLevel.EDIT,
      'delivery': PermissionLevel.EDIT,
      'promotions': PermissionLevel.EDIT,
      'reports': PermissionLevel.EDIT,
      'auditLogs': PermissionLevel.VIEW,
      'settings': PermissionLevel.NONE,  // No access to settings
      'settingsAdmin': PermissionLevel.NONE,
      'settingsPermissions': PermissionLevel.NONE,
      'settingsPayments': PermissionLevel.NONE,
      'settingsCommunications': PermissionLevel.NONE,
    }
  },
  {
    role: UserRole.SUPPORT_OFFICER,
    permissions: {
      // Support officer can access only dashboard and order management
      'dashboard': PermissionLevel.VIEW,
      'orders': PermissionLevel.EDIT,  // Order management access
      'categories': PermissionLevel.NONE,
      'products': PermissionLevel.NONE,
      'customers': PermissionLevel.VIEW,  // May need to view customer info for orders
      'bookings': PermissionLevel.NONE,
      'delivery': PermissionLevel.NONE,
      'promotions': PermissionLevel.NONE,
      'reports': PermissionLevel.NONE,
      'auditLogs': PermissionLevel.NONE,
      'settings': PermissionLevel.NONE,
      'settingsAdmin': PermissionLevel.NONE,
      'settingsPermissions': PermissionLevel.NONE,
      'settingsPayments': PermissionLevel.NONE,
      'settingsCommunications': PermissionLevel.NONE,
    }
  }
];

export const useRoleBasedPermissions = () => {
  const { user } = useAuth();

  const getUserRole = (): UserRole | null => {
    if (!user) return null;
    
    // Special case for toolbuxdev@gmail.com - always super_admin
    if (user.email === 'toolbuxdev@gmail.com') {
      return UserRole.SUPER_ADMIN;
    }
    
    // Map string role to enum
    switch (user.role) {
      case 'super_admin':
        return UserRole.SUPER_ADMIN;
      case 'admin':
        return UserRole.ADMIN;
      case 'manager':
        return UserRole.MANAGER;
      case 'support_officer':
        return UserRole.SUPPORT_OFFICER;
      default:
        return UserRole.SUPPORT_OFFICER; // Default fallback
    }
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
    if (!permission || permission === PermissionLevel.NONE) return false;

    // Check if user has required permission level
    if (requiredLevel === 'edit' && permission !== PermissionLevel.EDIT) return false;
    
    return true;
  };

  const canCreateUsers = (): boolean => {
    const userRole = getUserRole();
    return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || user?.email === 'toolbuxdev@gmail.com';
  };

  const canAssignRoles = (): boolean => {
    const userRole = getUserRole();
    return userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN || user?.email === 'toolbuxdev@gmail.com';
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
      .filter(([_, permission]) => permission !== PermissionLevel.NONE)
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
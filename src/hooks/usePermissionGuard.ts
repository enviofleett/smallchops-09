import { useRoleBasedPermissions } from './useRoleBasedPermissions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Enhanced permission guard with role-based access control
 * Used to ensure production-ready permission checking
 */
export const usePermissionGuard = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view') => {
  const { user, isLoading: authLoading } = useAuth();
  const { hasPermission, isLoading: roleLoading } = useRoleBasedPermissions();
  
  // PRODUCTION SECURITY: Enhanced safety checks
  const isLoading = authLoading || roleLoading;
  const isAuthenticated = !!user?.id;
  
  // PRODUCTION SECURITY: Role-based permission checking
  const roleBasedPermission = isAuthenticated && hasPermission(menuKey, requiredLevel);
  
  return {
    hasPermission: roleBasedPermission && !isLoading,
    isLoading,
    isAuthenticated,
    // Additional production context
    menuKey,
    requiredLevel,
    userRole: user?.role || null,
    debugInfo: process.env.NODE_ENV === 'development' ? {
      userAuthenticated: isAuthenticated,
      rawPermissionCheck: roleBasedPermission,
      isLoading: isLoading,
      userRole: user?.role,
      strictRoleMode: true
    } : undefined
  };
};

/**
 * Menu permission keys mapping to ensure consistency
 */
export const MENU_PERMISSION_KEYS = {
  dashboard: 'dashboard',
  orders: 'orders_view',
  categories: 'categories_view', 
  products: 'products_view',
  customers: 'customers_view',
  bookings: 'catering_bookings',
  delivery: 'delivery_zones',
  promotions: 'promotions_view',
  reports: 'reports-sales',
  auditLogs: 'audit_logs',
  settings: 'settings',
  // Settings sub-pages
  settingsAdmin: 'settings_admin_users',
  settingsPermissions: 'settings_admin_permissions',
  settingsPayments: 'settings_payments_providers',
  settingsCommunications: 'settings_communications_branding'
} as const;

export type MenuPermissionKey = typeof MENU_PERMISSION_KEYS[keyof typeof MENU_PERMISSION_KEYS];
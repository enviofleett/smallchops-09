import { useHasPermission } from './usePermissions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Enhanced permission guard with fallback safety measures
 * Used to ensure production-ready permission checking
 */
export const usePermissionGuard = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view') => {
  const { user, isLoading: authLoading } = useAuth();
  const hasPermission = useHasPermission(menuKey, requiredLevel);
  
  // PRODUCTION SECURITY: Enhanced safety checks
  const isLoading = authLoading;
  const isAuthenticated = !!user?.id;
  
  // PRODUCTION SECURITY: Enhanced triple validation for production access
  // 1. User must be authenticated
  // 2. User must have specific permission for the menu
  // 3. For admin users, only 'edit' permissions grant access (strict mode)
  const productionSafePermission = isAuthenticated && hasPermission && !isLoading;
  
  return {
    hasPermission: productionSafePermission,
    isLoading,
    isAuthenticated,
    // Additional production context
    menuKey,
    requiredLevel,
    debugInfo: process.env.NODE_ENV === 'development' ? {
      userAuthenticated: isAuthenticated,
      rawPermissionCheck: hasPermission,
      isLoading: isLoading,
      strictAdminMode: true
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
  discountCodes: 'discount_codes_view',
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
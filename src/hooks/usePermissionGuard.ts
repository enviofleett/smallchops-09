import { useHasPermission } from './usePermissions';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Enhanced permission guard with fallback safety measures
 * Used to ensure production-ready permission checking
 */
export const usePermissionGuard = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view') => {
  const { user, isLoading: authLoading } = useAuth();
  const hasPermission = useHasPermission(menuKey, requiredLevel);
  
  // Safety checks for production
  const isLoading = authLoading;
  const isAuthenticated = !!user?.id;
  
  // Return permission status with loading state
  return {
    hasPermission: isAuthenticated && hasPermission,
    isLoading,
    isAuthenticated
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
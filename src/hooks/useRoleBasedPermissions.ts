import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'super_admin' | 'store_owner' | 'admin_manager' | 'account_manager' | 'support_staff' | 'fulfilment_support' | 'admin' | 'manager' | 'support_officer' | 'staff';

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
      dashboard: 'edit',
      orders_view: 'edit',
      categories_view: 'edit',
      products_view: 'edit',
      customers_view: 'edit',
      catering_bookings: 'edit',
      delivery_zones: 'edit',
      promotions_view: 'edit',
      'reports-sales': 'edit',
      audit_logs: 'edit',
      settings: 'edit',
      settings_admin_users: 'edit',
      settings_admin_permissions: 'edit',
      settings_payments_providers: 'edit',
      settings_communications_branding: 'edit',
      settings_dev: 'edit' // Dev section access
    }
  },
  {
    role: 'store_owner',
    permissions: {
      dashboard: 'edit',
      orders_view: 'edit',
      categories_view: 'edit',
      products_view: 'edit',
      customers_view: 'edit',
      catering_bookings: 'edit',
      delivery_zones: 'edit',
      promotions_view: 'edit',
      'reports-sales': 'edit',
      audit_logs: 'edit',
      settings: 'edit',
      settings_admin_users: 'edit',
      settings_admin_permissions: 'edit',
      settings_payments_providers: 'edit',
      settings_communications_branding: 'edit',
      settings_dev: 'none' // No dev section access
    }
  },
  {
    role: 'support_staff',
    permissions: {
      dashboard: 'view',
      orders_view: 'edit',
      customers_view: 'edit',
      categories_view: 'none',
      products_view: 'none',
      catering_bookings: 'none',
      delivery_zones: 'none',
      promotions_view: 'none',
      'reports-sales': 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  {
    role: 'admin_manager',
    permissions: {
      dashboard: 'edit',
      products_view: 'edit',
      categories_view: 'edit',
      catering_bookings: 'edit',
      delivery_zones: 'edit',
      promotions_view: 'edit',
      orders_view: 'none',
      customers_view: 'none',
      'reports-sales': 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  {
    role: 'account_manager',
    permissions: {
      dashboard: 'edit',
      orders_view: 'edit',
      'reports-sales': 'edit',
      categories_view: 'none',
      products_view: 'none',
      customers_view: 'none',
      catering_bookings: 'none',
      delivery_zones: 'none',
      promotions_view: 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  {
    role: 'fulfilment_support',
    permissions: {
      dashboard: 'none', // RESTRICTED: Fulfillment support cannot view dashboard data
      orders_view: 'edit',
      delivery_zones: 'view',
      customers_view: 'view',
      categories_view: 'none',
      products_view: 'none',
      catering_bookings: 'none',
      promotions_view: 'none',
      'reports-sales': 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  // Legacy roles mapping to new system
  {
    role: 'admin',
    permissions: {
      dashboard: 'edit',
      orders_view: 'edit',
      categories_view: 'edit',
      products_view: 'edit',
      customers_view: 'edit',
      catering_bookings: 'edit',
      delivery_zones: 'edit',
      promotions_view: 'edit',
      'reports-sales': 'edit',
      audit_logs: 'view',
      settings: 'edit',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'edit',
      settings_communications_branding: 'edit',
      settings_dev: 'none'
    }
  },
  {
    role: 'manager',
    permissions: {
      dashboard: 'edit',
      orders_view: 'edit',
      categories_view: 'edit',
      products_view: 'edit',
      customers_view: 'view',
      catering_bookings: 'edit',
      delivery_zones: 'edit',
      promotions_view: 'edit',
      'reports-sales': 'view',
      audit_logs: 'none',
      settings: 'view',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  {
    role: 'support_officer',
    permissions: {
      dashboard: 'view',
      orders_view: 'edit',
      customers_view: 'edit',
      categories_view: 'none',
      products_view: 'none',
      catering_bookings: 'none',
      delivery_zones: 'none',
      promotions_view: 'none',
      'reports-sales': 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  },
  {
    role: 'staff',
    permissions: {
      dashboard: 'view',
      orders_view: 'view',
      categories_view: 'none',
      products_view: 'none',
      customers_view: 'none',
      catering_bookings: 'none',
      delivery_zones: 'none',
      promotions_view: 'none',
      'reports-sales': 'none',
      audit_logs: 'none',
      settings: 'none',
      settings_admin_users: 'none',
      settings_admin_permissions: 'none',
      settings_payments_providers: 'none',
      settings_communications_branding: 'none',
      settings_dev: 'none'
    }
  }
];

export const useRoleBasedPermissions = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = React.useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Fetch user role from user_roles table
  React.useEffect(() => {
    const fetchUserRole = async () => {
      setIsLoading(true);
      
      if (!user?.id) {
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      // CRITICAL PRODUCTION: Special case for toolbuxdev@gmail.com - always super_admin
      if (user.email === 'toolbuxdev@gmail.com') {
        console.log('🔐 SUPER ADMIN ACCESS: toolbuxdev@gmail.com detected, granting super_admin role');
        setUserRole('super_admin');
        setIsLoading(false);
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
          console.error('❌ Error fetching user role:', error);
          setUserRole(null);
          setIsLoading(false);
          return;
        }

        const fetchedRole = data?.role as UserRole || null;
        
        if (fetchedRole === null) {
          console.warn(`⚠️ User role is NULL for user ${user.id} (${user.email}). This may indicate a data integrity issue.`);
          console.warn('Please ensure the user has a valid role assigned in the user_roles table.');
        } else {
          console.log(`✅ User role fetched from user_roles table: ${fetchedRole} for user ${user.id}`);
        }
        
        setUserRole(fetchedRole);
        setIsLoading(false);
      } catch (err) {
        console.error('❌ Exception while fetching user role:', err);
        setUserRole(null);
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user?.id, user?.email]);

  const hasPermission = React.useCallback((menuKey: string, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    // CRITICAL: Special case for toolbuxdev@gmail.com - always has access
    if (user?.email === 'toolbuxdev@gmail.com') {
      return true;
    }

    if (!userRole) {
      return false;
    }

    const rolePermission = ROLE_PERMISSIONS.find(rp => rp.role === userRole);
    if (!rolePermission) return false;

    const permission = rolePermission.permissions[menuKey];
    if (!permission || permission === 'none') return false;

    // Check if user has required permission level
    if (requiredLevel === 'edit' && permission !== 'edit') return false;
    
    return true;
  }, [user?.email, userRole]);

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
    isLoading,
    hasPermission,
    canCreateUsers,
    canAssignRoles,
    getAccessibleMenus,
  };
};
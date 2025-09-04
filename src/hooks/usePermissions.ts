import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserPermission {
  menu_key: string;
  permission_level: 'none' | 'view' | 'edit';
  menu_section?: string;
  sub_menu_section?: string;
}

export const usePermissions = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('user_permissions')
        .select('menu_key, permission_level, menu_section, sub_menu_section')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as UserPermission[];
    },
    enabled: !!user?.id,
  });
};

export const useHasPermission = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view') => {
  const { data: permissions, isLoading } = usePermissions();
  const { user } = useAuth();

  // PRODUCTION SECURITY: Return false while loading permissions to prevent unauthorized access
  if (isLoading || !user?.id) return false;

  // PRODUCTION SECURITY: Find exact permission for the menu key
  let permission = permissions?.find(p => p.menu_key === menuKey);
  
  // PRODUCTION FALLBACK: Legacy key mapping for backward compatibility
  if (!permission) {
    const legacyKeyMap: Record<string, string> = {
      'orders_view': 'orders',
      'categories_view': 'categories', 
      'products_view': 'products',
      'customers_view': 'customers',
      'promotions_view': 'promotions',
      'reports-sales': 'reports',
      'delivery_zones': 'delivery'
    };
    
    const legacyKey = legacyKeyMap[menuKey];
    if (legacyKey) {
      permission = permissions?.find(p => p.menu_key === legacyKey);
    }
  }
  
  // PRODUCTION SECURITY: Deny access if no permission found (default deny policy)
  if (!permission) return false;

  // PRODUCTION SECURITY: Only allow access for valid permission levels
  // 'none' permission level explicitly denies access
  if (permission.permission_level === 'none') return false;

  // PRODUCTION ADMIN STRICT MODE: Admin users must have explicit 'edit' permissions
  // No admin overrides - all users including admins must have proper permissions
  const isAdminUser = permissions?.some(p => p.menu_key === 'settings_admin_users' && p.permission_level === 'edit');
  
  if (isAdminUser) {
    // PRODUCTION: Admins can only access menus with explicit 'edit' (Full Access) permissions
    return permission.permission_level === 'edit';
  }

  // PRODUCTION LOGIC: For regular users, allow view/edit based on required level
  if (requiredLevel === 'view') {
    return permission.permission_level === 'view' || permission.permission_level === 'edit';
  }

  // PRODUCTION LOGIC: For 'edit' access, only allow 'edit' level (full access)
  return permission.permission_level === 'edit';
};
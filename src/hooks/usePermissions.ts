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
  const permission = permissions?.find(p => p.menu_key === menuKey);
  
  // PRODUCTION SECURITY: Deny access if no permission found (default deny policy)
  if (!permission) return false;

  // PRODUCTION SECURITY: Only allow access for valid permission levels
  // 'none' permission level explicitly denies access
  if (permission.permission_level === 'none') return false;

  // PRODUCTION LOGIC: For 'view' access, allow both 'view' and 'edit' levels
  if (requiredLevel === 'view') {
    return permission.permission_level === 'view' || permission.permission_level === 'edit';
  }

  // PRODUCTION LOGIC: For 'edit' access, only allow 'edit' level (full access)
  return permission.permission_level === 'edit';
};
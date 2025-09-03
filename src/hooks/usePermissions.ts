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

  // Return false while loading permissions
  if (isLoading || !user?.id) return false;

  // Check specific permission for admin users too
  const permission = permissions?.find(p => p.menu_key === menuKey);
  if (!permission) return false;

  if (requiredLevel === 'view') {
    return permission.permission_level === 'view' || permission.permission_level === 'edit';
  }

  return permission.permission_level === 'edit';
};
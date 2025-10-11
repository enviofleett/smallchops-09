import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';
import { useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Roles that can view full dashboard
const DASHBOARD_AUTHORIZED_ROLES = [
  'super_admin',
  'store_owner',
  'admin_manager',
  'account_manager',
  'fulfilment_support',
] as const;

type DashboardAuthorizedRole = typeof DASHBOARD_AUTHORIZED_ROLES[number];

export const useDashboardAccess = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { userRole, isLoading: isRoleLoading } = useRoleBasedPermissions();

  const isLoading = isAuthLoading || isRoleLoading;

  const canViewDashboard = useMemo(() => {
    // Special case: toolbuxdev@gmail.com always has access
    if (user?.email === 'toolbuxdev@gmail.com') {
      return true;
    }

    // Check if user has authorized role
    if (!userRole) {
      return false;
    }

    return DASHBOARD_AUTHORIZED_ROLES.includes(userRole as DashboardAuthorizedRole);
  }, [user?.email, userRole]);

  // Log unauthorized dashboard access attempts
  useEffect(() => {
    if (!isLoading && !canViewDashboard && user && userRole) {
      // Log to audit_logs table
      supabase
        .from('audit_logs')
        .insert({
          action: 'dashboard_access_denied',
          category: 'Security',
          message: `Dashboard access denied for user with role: ${userRole}`,
          user_id: user.id,
          new_values: {
            user_email: user.email,
            user_role: userRole,
            attempted_at: new Date().toISOString(),
          },
        })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to log dashboard access denial:', error);
          }
        });
    }
  }, [isLoading, canViewDashboard, user, userRole]);

  return {
    canViewDashboard,
    isLoading,
    userRole,
  };
};

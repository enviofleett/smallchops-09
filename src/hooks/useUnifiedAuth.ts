import { useAuth } from '@/contexts/AuthContext';
import { useRoleBasedPermissions, UserRole } from './useRoleBasedPermissions';
import { usePermissions } from './usePermissions';
import { useMemo } from 'react';

/**
 * Unified authentication hook that consolidates all auth-related checks
 * for production-ready admin access control
 */
export const useUnifiedAuth = () => {
  const { user, isAuthenticated, isLoading, userType, session } = useAuth();
  const { userRole, hasPermission: roleBasedPermission, canAssignRoles, canCreateUsers } = useRoleBasedPermissions();
  const { data: dbPermissions, isLoading: permissionsLoading } = usePermissions();

  // Consolidate loading states
  const isAuthLoading = isLoading || permissionsLoading;

  // Production-safe admin check
  const isAdmin = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Check admin user type and role
    return userType === 'admin' && user.role && ['super_admin', 'manager', 'support_officer', 'admin'].includes(user.role);
  }, [isAuthenticated, user, userType]);

  // Unified permission check
  const hasMenuPermission = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    if (!isAuthenticated || !user || isAuthLoading) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Use role-based permissions as primary system
    return roleBasedPermission(menuKey, requiredLevel);
  };

  // Production-ready role check
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!isAdmin || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Super admin has all roles
    if (user.role === 'super_admin') return true;
    
    // Exact role match
    return user.role === requiredRole;
  };

  // Check if user can access admin panel at all
  const canAccessAdmin = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Must be admin type with valid role
    return isAdmin && user.role && ['super_admin', 'manager', 'support_officer', 'admin'].includes(user.role);
  }, [isAuthenticated, user, isAdmin]);

  return {
    // Core auth state
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    userType,
    session,
    
    // Admin-specific state
    isAdmin,
    canAccessAdmin,
    userRole,
    
    // Permission functions
    hasMenuPermission,
    hasRole,
    canAssignRoles,
    canCreateUsers,
    
    // Database permissions (for reference)
    dbPermissions,
  };
};

export type UnifiedAuth = ReturnType<typeof useUnifiedAuth>;
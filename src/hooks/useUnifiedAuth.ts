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

  // Production-safe admin check using role-based permissions
  const isAdmin = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Check if user has any admin role from user_roles table
    return userType === 'admin' && userRole !== null;
  }, [isAuthenticated, user, userType, userRole]);

  // Unified permission check
  const hasMenuPermission = (menuKey: string, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    if (!isAuthenticated || !user || isAuthLoading) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Use role-based permissions as primary system
    return roleBasedPermission(menuKey, requiredLevel);
  };

  // Production-ready role check using user_roles table
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!isAdmin || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Super admin has all roles
    if (userRole === 'super_admin') return true;
    
    // Exact role match
    return userRole === requiredRole;
  };

  // Check if user can access admin panel at all
  const canAccessAdmin = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Must be admin type with valid role from user_roles table
    return isAdmin && userRole !== null;
  }, [isAuthenticated, user, isAdmin, userRole]);

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
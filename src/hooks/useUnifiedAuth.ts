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
  const { userRole, hasPermission: roleBasedPermission, canAssignRoles, canCreateUsers, isLoading: roleLoading } = useRoleBasedPermissions();
  const { data: dbPermissions, isLoading: permissionsLoading } = usePermissions();
  const { toast } = useToast();
  
  // User type validation removed - was causing 401 errors due to edge function project mismatch

  // Consolidate loading states
  const isAuthLoading = isLoading || permissionsLoading || roleLoading;

  // Production-safe admin check using role-based permissions
  const isAdmin = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Special case for toolbuxdev@gmail.com
    if (user.email === 'toolbuxdev@gmail.com') return true;
    
    // Check if user has any valid role from user_roles table
    // This allows support_staff and other roles to access admin areas
    return userRole !== null;
  }, [isAuthenticated, user, userRole]);

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
    
    // Allow access if user has any valid role from user_roles table
    // This includes support_staff, account_manager, etc.
    return userRole !== null;
  }, [isAuthenticated, user, userRole]);

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

/**
 * Unified role system for the entire admin application
 * This is the single source of truth for all role definitions
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin', 
  MANAGER = 'manager',
  SUPPORT_OFFICER = 'support_officer'
}

/**
 * Type alias for backwards compatibility
 * @deprecated Use UserRole enum instead
 */
export type UserRoleType = 'super_admin' | 'admin' | 'manager' | 'support_officer';

/**
 * Permission levels for menu access control
 */
export enum PermissionLevel {
  NONE = 'none',
  VIEW = 'view',
  EDIT = 'edit'
}

/**
 * Permission level type for backwards compatibility
 */
export type PermissionLevelType = 'none' | 'view' | 'edit';

/**
 * Interface for role-based permission configuration
 */
export interface RolePermission {
  role: UserRole;
  permissions: {
    [menuKey: string]: PermissionLevel;
  };
}

export interface User {
  id: string;
  name: string;
  role: UserRoleType;
  avatar_url?: string | null;
  email: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

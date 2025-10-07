
import { UserRole } from '@/hooks/useRoleBasedPermissions';

export interface User {
  id: string;
  name: string;
  role?: UserRole;
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


export interface User {
  id: string;
  name: string;
  role?: 'super_admin' | 'admin' | 'manager' | 'support_officer' | 'staff';
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


export interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'staff' | 'dispatch_rider';
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

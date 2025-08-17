
export interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  hasHydrated: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
}

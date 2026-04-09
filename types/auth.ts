export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  hasHydrated: boolean;
}

export interface LoginFormErrors {
  email?: string;
  password?: string;
}

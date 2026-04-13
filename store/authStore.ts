import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { authService } from '../services/authService';
import { userService } from '../services/userService';
import { isApiError } from '../types/api';
import type { AuthState, LoginRequest, UserProfile } from '../types/auth';

interface AuthStore extends AuthState {
  login: (payload: LoginRequest) => Promise<boolean>;
  fetchCurrentUser: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

const secureStorage: StateStorage = {
  getItem: async (name) => {
    const value = await SecureStore.getItemAsync(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      hasHydrated: false,
      setHasHydrated: (value) => {
        set({ hasHydrated: value });
      },
      clearError: () => {
        set({ error: null });
      },
      login: async (payload) => {
        set({ loading: true, error: null });

        try {
          const response = await authService.login(payload);
          const user = await userService.getCurrentUserFromToken(response.token);

          set({
            token: response.token,
            user,
            isAuthenticated: true,
            loading: false,
            error: null,
          });
          return true;
        } catch (error) {
          const message = isApiError(error)
            ? error.message
            : 'Something went wrong. Please try again later.';

          set({
            token: null,
            user: null,
            isAuthenticated: false,
            loading: false,
            error: message,
          });
          return false;
        }
      },
      fetchCurrentUser: async () => {
        const token = get().token;

        if (!token) {
          return null;
        }

        const user = await userService.getCurrentUserFromToken(token);
        set({ user });
        return user;
      },
      logout: async () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },
    }),
    {
      name: 'habit-tracker-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error && state) {
          state.setHasHydrated(true);
          return;
        }

        state?.setHasHydrated(true);
      },
    }
  )
);

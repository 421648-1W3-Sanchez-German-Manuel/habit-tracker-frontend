import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { authService } from '../services/authService';
import { isApiError } from '../types/api';
import type { AuthState, LoginRequest } from '../types/auth';

interface AuthStore extends AuthState {
  login: (payload: LoginRequest) => Promise<boolean>;
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
    (set) => ({
      token: null,
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
          set({
            token: response.token,
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
            isAuthenticated: false,
            loading: false,
            error: message,
          });
          return false;
        }
      },
      logout: async () => {
        set({
          token: null,
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

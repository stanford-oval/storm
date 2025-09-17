// Authentication store slice
import { create } from 'zustand';
import {
  AuthState,
  User,
  UserPreferences,
  NotificationPreferences,
} from '../types';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Default user preferences
const defaultPreferences: UserPreferences = {
  theme: 'system',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  notifications: {
    email: true,
    browser: true,
    pipeline: true,
    errors: true,
  },
};

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  sessionExpiry: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Auth store actions interface
interface AuthActions {
  // Authentication actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  register: (userData: {
    email: string;
    password: string;
    name: string;
  }) => Promise<void>;

  // User management
  updateUser: (updates: Partial<User>) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  updateNotificationPreferences: (
    notifications: Partial<NotificationPreferences>
  ) => void;

  // Session management
  extendSession: () => Promise<void>;
  checkSessionValidity: () => boolean;
  clearSession: () => void;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;

  // Token management
  setTokens: (token: string, refreshToken: string, expiresIn: number) => void;
  clearTokens: () => void;
  isTokenExpired: () => boolean;
}

// Auth store type
export type AuthStore = AuthState & AuthActions;

// Create auth store
export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      subscriptions(
        immer<AuthStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Authentication actions
          login: async credentials => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              // Simulate API call - replace with actual authentication
              const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials),
              });

              if (!response.ok) {
                throw new Error('Invalid credentials');
              }

              const data = await response.json();
              const { user, token, refreshToken, expiresIn } = data;

              set(draft => {
                draft.user = {
                  ...user,
                  preferences: user.preferences || defaultPreferences,
                };
                draft.token = token;
                draft.refreshToken = refreshToken;
                draft.sessionExpiry = new Date(Date.now() + expiresIn * 1000);
                draft.isAuthenticated = true;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error ? error.message : 'Login failed';
                draft.loading = false;
                draft.isAuthenticated = false;
              });
              throw error;
            }
          },

          logout: () => {
            set(draft => {
              draft.user = null;
              draft.token = null;
              draft.refreshToken = null;
              draft.sessionExpiry = null;
              draft.isAuthenticated = false;
              draft.error = null;
              draft.lastUpdated = new Date();
            });

            // Clear any stored tokens
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
          },

          register: async userData => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
              });

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Registration failed');
              }

              const data = await response.json();

              // Auto-login after successful registration
              await get().login({
                email: userData.email,
                password: userData.password,
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Registration failed';
                draft.loading = false;
              });
              throw error;
            }
          },

          refreshAuth: async () => {
            const { refreshToken } = get();
            if (!refreshToken) {
              throw new Error('No refresh token available');
            }

            try {
              const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
              });

              if (!response.ok) {
                throw new Error('Token refresh failed');
              }

              const data = await response.json();
              const { token, refreshToken: newRefreshToken, expiresIn } = data;

              set(draft => {
                draft.token = token;
                draft.refreshToken = newRefreshToken;
                draft.sessionExpiry = new Date(Date.now() + expiresIn * 1000);
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              // If refresh fails, log out the user
              get().logout();
              throw error;
            }
          },

          // User management
          updateUser: updates => {
            set(draft => {
              if (draft.user) {
                Object.assign(draft.user, updates);
                draft.lastUpdated = new Date();
              }
            });
          },

          updatePreferences: preferences => {
            set(draft => {
              if (draft.user) {
                Object.assign(draft.user.preferences, preferences);
                draft.lastUpdated = new Date();
              }
            });
          },

          updateNotificationPreferences: notifications => {
            set(draft => {
              if (draft.user) {
                Object.assign(
                  draft.user.preferences.notifications,
                  notifications
                );
                draft.lastUpdated = new Date();
              }
            });
          },

          // Session management
          extendSession: async () => {
            if (!get().isTokenExpired()) {
              await get().refreshAuth();
            }
          },

          checkSessionValidity: () => {
            const { sessionExpiry, isAuthenticated } = get();
            if (!isAuthenticated || !sessionExpiry) {
              return false;
            }
            return new Date() < sessionExpiry;
          },

          clearSession: () => {
            set(draft => {
              draft.token = null;
              draft.refreshToken = null;
              draft.sessionExpiry = null;
              draft.isAuthenticated = false;
            });
          },

          // State management
          setLoading: loading => {
            set(draft => {
              draft.loading = loading;
            });
          },

          setError: error => {
            set(draft => {
              draft.error = error;
            });
          },

          clearError: () => {
            set(draft => {
              draft.error = null;
            });
          },

          reset: () => {
            set(draft => {
              Object.assign(draft, initialState);
            });
          },

          // Token management
          setTokens: (token, refreshToken, expiresIn) => {
            set(draft => {
              draft.token = token;
              draft.refreshToken = refreshToken;
              draft.sessionExpiry = new Date(Date.now() + expiresIn * 1000);
              draft.lastUpdated = new Date();
            });
          },

          clearTokens: () => {
            set(draft => {
              draft.token = null;
              draft.refreshToken = null;
              draft.sessionExpiry = null;
            });
          },

          isTokenExpired: () => {
            const { sessionExpiry } = get();
            if (!sessionExpiry) return true;
            return new Date() >= sessionExpiry;
          },
        }))
      ),
      {
        name: 'storm-auth-store',
        version: 1,
        partialize: createPartialize<AuthStore>([
          'user',
          'token',
          'refreshToken',
          'sessionExpiry',
          'isAuthenticated',
        ]),
      }
    ),
    { name: 'AuthStore' }
  )
);

// Selectors
export const authSelectors = {
  user: (state: AuthStore) => state.user,
  isAuthenticated: (state: AuthStore) => state.isAuthenticated,
  isLoading: (state: AuthStore) => state.loading,
  error: (state: AuthStore) => state.error,
  token: (state: AuthStore) => state.token,
  preferences: (state: AuthStore) => state.user?.preferences,
  theme: (state: AuthStore) => state.user?.preferences?.theme || 'system',
  notifications: (state: AuthStore) => state.user?.preferences?.notifications,
  sessionExpiry: (state: AuthStore) => state.sessionExpiry,
  isSessionValid: (state: AuthStore) => state.checkSessionValidity(),
  isTokenExpired: (state: AuthStore) => state.isTokenExpired(),
};

// Auth hooks
export const useAuth = () => {
  const store = useAuthStore();
  return {
    ...store,
    selectors: authSelectors,
  };
};

export const useAuthUser = () => useAuthStore(authSelectors.user);
export const useAuthStatus = () => useAuthStore(authSelectors.isAuthenticated);
export const useAuthLoading = () => useAuthStore(authSelectors.isLoading);
export const useAuthError = () => useAuthStore(authSelectors.error);
export const useUserThemePreference = () => useAuthStore(authSelectors.theme);
export const useNotificationPreferences = () =>
  useAuthStore(authSelectors.notifications);

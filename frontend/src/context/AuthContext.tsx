import React, {
  createContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { authService } from '@/services/auth.service';
import type { User } from '@/types/api';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { user: fetchedUser } = await authService.getMe();
      setUser(fetchedUser);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Proceed with local state reset even if server logout fails
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  }, []);

  // On mount: Store token from query string in localStorage if present,
  // then query GET /api/auth/me using Bearer token or HTTP-only cookie.
  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenParam = params.get('token');
      if (tokenParam) {
        localStorage.setItem('auth_token', tokenParam);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('token');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
      }

      await refreshUser();
      setLoading(false);
    };

    void init();
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiUrl, fetchWithTimeout } from '../utils/apiBase';

interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  user_type?: string;
  tier?: string; // 'starter' | 'standard' | 'pro'
  email_optin?: boolean; // Marketing email opt-in preference
  subscription_status?: string; // 'active' | 'expired' | 'cancelled'
  subscription_expiration_date?: string; // ISO date string
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  /**
   * Used for external auth flows (e.g., Supabase Google OAuth):
   * sets the app's JWT token and loads the current user from FastAPI.
   */
  setAuthToken: (accessToken: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>; // Refresh user data from API
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Auth calls can be slow on cold DB / tunnel. */
const AUTH_FETCH_TIMEOUT_MS = 45_000;

function authRequestTimeoutMessage(): string {
  const health =
    typeof window !== 'undefined' ? `${window.location.origin}/api/health` : '/api/health';
  return `No response within ${AUTH_FETCH_TIMEOUT_MS / 1000}s. Start the API (dev: port 3002, Vite proxies /api). Check ${health}.`;
}

function normalizeAuthUser(raw: unknown): User {
  const r = raw as Record<string, unknown>;
  const isAdmin = Boolean(r.is_admin);
  const userType =
    typeof r.user_type === 'string' && r.user_type
      ? r.user_type
      : isAdmin
        ? 'admin'
        : 'subscriber';
  const created = r.created_at;
  return {
    id: Number(r.id),
    username: String(r.username ?? ''),
    email: String(r.email ?? ''),
    is_admin: isAdmin,
    user_type: userType,
    tier: typeof r.tier === 'string' ? r.tier : 'standard',
    email_optin: r.email_optin == null ? undefined : Boolean(r.email_optin),
    subscription_status:
      typeof r.subscription_status === 'string' ? r.subscription_status : undefined,
    subscription_expiration_date:
      r.subscription_expiration_date == null
        ? undefined
        : String(r.subscription_expiration_date),
    created_at: created != null ? String(created) : '',
  };
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (authToken: string): Promise<User> => {
    try {
      const response = await fetchWithTimeout(
        apiUrl('/api/auth/me'),
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
        AUTH_FETCH_TIMEOUT_MS
      );

      if (response.ok) {
        const raw = await response.json();
        const userData = normalizeAuthUser(raw);
        setUser(userData);
        setIsLoading(false);
        return userData;
      }

      const errorText = await response.text();

      // 401: only clear storage if this response is for the token still in use. Avoids a stale
      // in-flight /me (old token) wiping the session after a successful login replaced the token.
      if (response.status === 401) {
        const stored = localStorage.getItem('auth_token');
        if (stored === authToken) {
          localStorage.removeItem('auth_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
      throw new Error(`Failed to fetch user data: ${response.status} - ${errorText}`);
    } catch (error: any) {
      setIsLoading(false);
      const isAbort =
        error?.name === 'AbortError' ||
        (typeof DOMException !== 'undefined' &&
          error instanceof DOMException &&
          error.name === 'AbortError');
      if (isAbort) {
        throw new Error(authRequestTimeoutMessage());
      }
      const msg = typeof error?.message === 'string' ? error.message : '';
      const isNetwork =
        msg === 'Failed to fetch' ||
        error?.name === 'TypeError' ||
        msg.includes('NetworkError') ||
        msg.includes('Network request failed');
      if (isNetwork) {
        throw error;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      void fetchUserData(storedToken).catch(() => {
        /* errors surfaced on next login / refresh; isLoading cleared in fetchUserData */
      });
    } else {
      setIsLoading(false);
    }
  }, [fetchUserData]);

  const setAuthToken = async (accessToken: string) => {
    localStorage.setItem('auth_token', accessToken);
    setToken(accessToken);
    setIsLoading(true);
    try {
      await fetchUserData(accessToken);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await fetchWithTimeout(
        apiUrl('/api/auth/login'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
          mode: 'cors',
        },
        AUTH_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        const bodyText = await response.text();
        let errorMessage = 'Login failed';
        if (bodyText) {
          try {
            const errorData = JSON.parse(bodyText) as { detail?: unknown; message?: string };
            const detail =
              typeof errorData.detail === 'string'
                ? errorData.detail
                : Array.isArray(errorData.detail)
                  ? errorData.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
                  : undefined;
            errorMessage = detail || errorData.message || bodyText;
          } catch {
            errorMessage = bodyText;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const authToken = data.access_token;

      if (!authToken) {
        throw new Error('No access token received from server');
      }

      localStorage.setItem('auth_token', authToken);
      setToken(authToken);

      const me = await fetchUserData(authToken);
      return me;
    } catch (error: any) {
      const isAbort =
        error?.name === 'AbortError' ||
        (typeof DOMException !== 'undefined' &&
          error instanceof DOMException &&
          error.name === 'AbortError');
      if (isAbort) {
        throw new Error(authRequestTimeoutMessage());
      }
      const msg = typeof error?.message === 'string' ? error.message : '';
      if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Network request failed')) {
        throw new Error(
          `Unable to connect to server. Ensure the API is reachable (dev: run FastAPI on port 3002 and use the Vite proxy, or set VITE_API_URL). Try ${apiUrl('/api/health')} in the browser.`
        );
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem('auth_token');
    if (currentToken) {
      try {
        // Call logout endpoint to check subscription expiration
        await fetch(apiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
          },
        });
      } catch (error) {
        console.error('Error calling logout endpoint:', error);
        // Continue with logout even if endpoint fails
      }
    }
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    const currentToken = token || localStorage.getItem('auth_token');
    if (currentToken) {
      try {
        await fetchUserData(currentToken);
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  }, [token, fetchUserData]);

  const effectiveToken = token || localStorage.getItem('auth_token');
  const isAuthenticated = !!effectiveToken && !!user;

  const value = {
    user,
    token,
    login,
    setAuthToken,
    logout,
    refreshUser,
    isLoading,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


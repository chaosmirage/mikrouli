// Context, provider, and hook are intentionally co-located in one module.
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, clearTokens, getAccessToken, setTokens } from '../api/client';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextValue {
  user: User | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User> {
  return apiFetch<User>('/api/auth/me');
}

async function loginRequest(email: string, password: string): Promise<TokenPair> {
  return apiFetch<TokenPair>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function registerRequest(email: string, password: string): Promise<User> {
  return apiFetch<User>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function bootstrapUser(): Promise<User | null> {
  if (!getAccessToken()) return null;
  try {
    return await fetchMe();
  } catch {
    clearTokens();
    return null;
  }
}

async function performLogin(email: string, password: string): Promise<User> {
  const tokens = await loginRequest(email, password);
  setTokens(tokens.accessToken, tokens.refreshToken);
  return fetchMe();
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void bootstrapUser()
      .then(setUser)
      .finally(() => setBootstrapping(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const me = await performLogin(email, password);
    setUser(me);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await registerRequest(email, password);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const value = useMemo(
    () => ({ user, bootstrapping, login, register, logout }),
    [user, bootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

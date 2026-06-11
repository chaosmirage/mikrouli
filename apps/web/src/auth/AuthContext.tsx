// Context, provider, and hook are intentionally co-located in one module.
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { MeResponse } from '../api/types';

export type User = MeResponse;

export interface AuthContextValue {
  user: User | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    return await apiFetch('/api/auth/me', 'get');
  } catch {
    // 401 means no active session — return null to indicate logged-out state.
    return null;
  }
}

async function loginRequest(email: string, password: string): Promise<User> {
  // The API sets HttpOnly cookies on success; the body carries the UserProfile.
  return apiFetch('/api/auth/login', 'post', { body: { email, password } });
}

async function registerRequest(email: string, password: string): Promise<User> {
  return apiFetch('/api/auth/register', 'post', { body: { email, password } });
}

async function logoutRequest(): Promise<void> {
  await apiFetch('/api/auth/logout', 'post');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user, isLoading: bootstrapping } = useQuery({
    queryKey: ['user'],
    // Always probe /me to determine session state — the HttpOnly cookie is sent
    // automatically by the browser via credentials:'include' in apiFetch.
    queryFn: fetchMe,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      loginRequest(email, password),
    onSuccess: (me) => {
      queryClient.setQueryData(['user'], me);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await registerRequest(email, password);
    },
  });

  const login = useCallback(
    async (email: string, password: string) => {
      await loginMutation.mutateAsync({ email, password });
    },
    [loginMutation],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      await registerMutation.mutateAsync({ email, password });
    },
    [registerMutation],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    // Invalidate all cached data after the server-side session is revoked.
    await queryClient.invalidateQueries();
    queryClient.setQueryData(['user'], null);
    navigate('/login');
  }, [queryClient, navigate]);

  const value = useMemo(
    () => ({ user: user ?? null, bootstrapping, login, register, logout }),
    [user, bootstrapping, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

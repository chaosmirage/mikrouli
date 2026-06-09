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
import { apiFetch, clearTokens, getAccessToken, setTokens } from '../api/client';
import type { MeResponse, LoginResponse } from '../api/types';

export type User = MeResponse;

export interface AuthContextValue {
  user: User | null;
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User> {
  return apiFetch('/api/auth/me', 'get');
}

async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  return apiFetch('/api/auth/login', 'post', { body: { email, password } });
}

async function registerRequest(email: string, password: string): Promise<User> {
  return apiFetch('/api/auth/register', 'post', { body: { email, password } });
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: user, isLoading: bootstrapping } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      if (!getAccessToken()) return null;
      try {
        return await fetchMe();
      } catch {
        clearTokens();
        return null;
      }
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const tokens = await loginRequest(email, password);
      setTokens(tokens.accessToken, tokens.refreshToken);
      const me = await fetchMe();
      return me;
    },
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

  const logout = useCallback(() => {
    clearTokens();
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

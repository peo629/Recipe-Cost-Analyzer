import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentAuthUser,
  signup as signupRequest,
  login as loginRequest,
  logout as logoutRequest,
  getGoogleAuthAvailability,
  getGetCurrentAuthUserQueryKey,
  getGetGoogleAuthAvailabilityQueryKey,
} from "@workspace/api-client-react";
import type {
  AuthUser,
  SignupBody,
  LoginBody,
} from "@workspace/api-client-react";

export type { AuthUser };

interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  googleAvailable: boolean;
  signupAsync: (body: SignupBody) => Promise<AuthUser>;
  loginAsync: (body: LoginBody) => Promise<AuthUser>;
  logout: () => Promise<void>;
  loginWithGoogle: (returnTo?: string) => void;
}

/**
 * The single source of truth for the current authenticated user.
 *
 * - GET  /api/auth/user                 — fetched on mount
 * - POST /api/auth/signup, /login       — invalidate the user query on success
 * - POST /api/auth/logout               — clears the cache
 * - GET  /api/auth/google/available     — controls whether the Google button
 *                                         is rendered on the login form
 */
export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: getGetCurrentAuthUserQueryKey(),
    queryFn: () => getCurrentAuthUser(),
    staleTime: 60_000,
    retry: false,
  });

  const googleAvailabilityQuery = useQuery({
    queryKey: getGetGoogleAuthAvailabilityQueryKey(),
    queryFn: () => getGoogleAuthAvailability(),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const signupMutation = useMutation({
    mutationFn: (body: SignupBody) => signupRequest(body),
    onSuccess: (data) => {
      queryClient.setQueryData(getGetCurrentAuthUserQueryKey(), {
        user: data.user,
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: (body: LoginBody) => loginRequest(body),
    onSuccess: (data) => {
      queryClient.setQueryData(getGetCurrentAuthUserQueryKey(), {
        user: data.user,
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => logoutRequest(),
    onSuccess: () => {
      queryClient.setQueryData(getGetCurrentAuthUserQueryKey(), { user: null });
      queryClient.removeQueries();
    },
  });

  const loginWithGoogle = useCallback((returnTo?: string) => {
    const target =
      returnTo ?? window.location.pathname + window.location.search;
    const safe =
      target.startsWith("/") && !target.startsWith("//") ? target : "/";
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(safe)}`;
  }, []);

  return {
    user: userQuery.data?.user ?? null,
    isLoading: userQuery.isLoading,
    isAuthenticated: !!userQuery.data?.user,
    googleAvailable: googleAvailabilityQuery.data?.available ?? false,
    signupAsync: async (body) => {
      const result = await signupMutation.mutateAsync(body);
      return result.user;
    },
    loginAsync: async (body) => {
      const result = await loginMutation.mutateAsync(body);
      return result.user;
    },
    logout: async () => {
      await logoutMutation.mutateAsync();
    },
    loginWithGoogle,
  };
}

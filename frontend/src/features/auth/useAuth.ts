import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, type AuthCredentials } from '@/api/auth';
import { useAuthStore } from './authStore';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (creds: AuthCredentials) => authApi.login(creds),
    onSuccess: (data) => setSession(data.access_token, data.user),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (creds: AuthCredentials) => authApi.register(creds),
    onSuccess: (data) => setSession(data.access_token, data.user),
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  return () => {
    logout();
    queryClient.clear();
  };
}

export function useCurrentUser() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}

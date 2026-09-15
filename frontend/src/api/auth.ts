import { apiClient } from './client';
import type { PasswordChangeInput, ProfileUpdateInput, TokenResponse, User } from '@/types/api';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthCredentials {
  full_name?: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export const authApi = {
  register: async (input: RegisterInput): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/register', input);
    return data;
  },
  login: async (input: AuthCredentials): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', input);
    return data;
  },
  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },
  resetPassword: async (input: ResetPasswordInput): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/reset-password', input);
    return data;
  },
  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  },
  updateProfile: async (input: ProfileUpdateInput): Promise<User> => {
    const { data } = await apiClient.patch<User>('/auth/me', input);
    return data;
  },
  changePassword: async (input: PasswordChangeInput): Promise<User> => {
    const { data } = await apiClient.post<User>('/auth/change-password', input);
    return data;
  },
};

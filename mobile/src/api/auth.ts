import { apiClient } from './client';
import type { TokenResponse } from '../types/api';

export interface AuthCredentials {
  email: string;
  password: string;
}

export const authApi = {
  register: async (input: AuthCredentials): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/register', input);
    return data;
  },
  login: async (input: AuthCredentials): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', input);
    return data;
  },
};

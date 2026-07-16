import axios, { AxiosError, type AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';

// Where the FastAPI backend lives, from app.json > expo.extra.apiBaseUrl.
// Android emulator reaches the host machine at 10.0.2.2; iOS simulator uses
// localhost; a physical device needs your machine's LAN IP (see mobile/README).
const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://10.0.2.2:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; error?: string }>) => {
    // Session expired / invalid → drop credentials so the app returns to login.
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; error?: string } | undefined;
    return data?.error ?? data?.detail ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

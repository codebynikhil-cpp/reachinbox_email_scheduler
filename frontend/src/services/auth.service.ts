import apiClient from './api';
import type { AuthMeResponse, LogoutResponse } from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

export const authService = {
  /**
   * Get the Google OAuth login URL.
   * Using a direct backend redirect URL so the browser navigates server-side.
   */
  getGoogleLoginUrl(): string {
    return `${API_BASE_URL}/api/auth/google`;
  },

  /**
   * Get the current authenticated user profile.
   * Relies on the HTTP-only cookie sent automatically by the browser (withCredentials: true).
   */
  async getMe(): Promise<AuthMeResponse> {
    const { data } = await apiClient.get<AuthMeResponse>('/api/auth/me');
    return data;
  },

  /**
   * Log out the current user (clears server-side cookie).
   */
  async logout(): Promise<LogoutResponse> {
    const { data } = await apiClient.post<LogoutResponse>('/api/auth/logout');
    return data;
  },
};

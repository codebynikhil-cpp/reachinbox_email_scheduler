import axios from 'axios';

const rawUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const API_BASE_URL = rawUrl.replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send HTTP-only cookies automatically with every request
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: attach Authorization header from localStorage ───────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: handle 401 globally ───────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Clear potentially invalid token
      localStorage.removeItem('auth_token');
      // Redirect to login on 401 unauthorized, avoiding infinite redirect loop
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

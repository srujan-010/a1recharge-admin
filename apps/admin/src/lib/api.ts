import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const PRODUCTION_ADMIN_BACKEND = 'https://a1recharge-admin.onrender.com/api';

/**
 * Determine the authoritative Admin Backend API Base URL
 */
const getBaseUrl = (): string => {
  // 1. Check environment variables (Next.js, Vite, or Create-React-App naming)
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL || process.env.REACT_APP_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    const trimmed = envUrl.trim();
    if (trimmed.endsWith('/api')) return trimmed;
    if (trimmed.endsWith('/')) return `${trimmed}api`;
    return `${trimmed}/api`;
  }

  // 2. Client-side browser execution check
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
    if (!isLocalhost) {
      // In production web deployment (e.g. Vercel), ALWAYS target Render Admin Backend
      return PRODUCTION_ADMIN_BACKEND;
    }
  }

  // 3. Node environment check
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_ADMIN_BACKEND;
  }

  // 4. Local development fallback
  return 'http://localhost:5001/api';
};

// Get token from localStorage (client-side only)
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
};

export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token and Idempotency-Key
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach Idempotency-Key for mutation requests
    if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      config.headers['Idempotency-Key'] = uuidv4();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle 401s and preserve backend error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Log the actual error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[API Error]:',
        error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message
      );
    }

    // Extract the backend message if available
    const backendMessage = error.response?.data?.message || error.response?.data?.error;
    const sanitizedError = new Error(backendMessage || error.message || 'This operation could not be completed. Please try again.');
    return Promise.reject(sanitizedError);
  }
);

export default api;

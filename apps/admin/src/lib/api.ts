import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Get token from localStorage (client-side only)
const getToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('admin_token');
  }
  return null;
};

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
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

// Response interceptor to handle 401s and sanitize error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // Log the actual error to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[API Error]:',
        error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message
      );
    }

    // Extract the backend message if available, otherwise use a generic one
    const backendMessage = error.response?.data?.message;
    const sanitizedError = new Error(backendMessage || 'This operation could not be completed. Please try again.');
    return Promise.reject(sanitizedError);
  }
);

export default api;

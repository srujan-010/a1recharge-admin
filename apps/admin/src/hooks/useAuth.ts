import { useEffect, useState } from 'react';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE' | 'SUPPORT';
}

export function useAuth() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('admin_token');
      const storedUser = localStorage.getItem('admin_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        const parsedUser = JSON.parse(storedUser);
        // Fallback for sessions that stored the raw response.data instead of the admin object
        if (parsedUser && parsedUser.admin) {
          setUser(parsedUser.admin);
          // Auto-heal local storage
          localStorage.setItem('admin_user', JSON.stringify(parsedUser.admin));
        } else {
          setUser(parsedUser);
        }
      } else {
        // If no auth on a protected route (dashboard), redirect to login
        if (window.location.pathname.startsWith('/dashboard')) {
          window.location.href = '/login';
        }
      }
    } catch (e) {
      console.error('Auth restore failed', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  };

  return { user, token, isLoading, logout };
}

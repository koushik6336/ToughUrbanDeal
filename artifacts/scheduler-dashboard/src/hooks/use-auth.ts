import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetMe, getGetMeQueryKey } from '@workspace/api-client-react';

export function useAuth() {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem('auth_token');
  const isAuthenticated = !!token;

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    }
  });

  useEffect(() => {
    if (error && (error as any)?.status === 401) {
      localStorage.removeItem('auth_token');
      setLocation('/login');
    }
  }, [error, setLocation]);

  const logout = () => {
    localStorage.removeItem('auth_token');
    setLocation('/login');
  };

  return {
    user,
    isLoading: isAuthenticated ? isLoading : false,
    isAuthenticated,
    logout,
  };
}

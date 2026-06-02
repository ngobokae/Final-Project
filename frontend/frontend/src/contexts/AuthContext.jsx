import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { apiPost, apiGet, apiPut } from '../utils/api';

const AuthContext = createContext(null);

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
      const parsed = JSON.parse(storedUser);
      setUser(parsed);
      setToken(storedToken);
      applyTheme(parsed.theme || 'light');
      verifyToken(storedToken);
    } else {
      applyTheme('light');
      setIsLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const data = await apiGet('/api/auth/verify');
      if (data.success) {
        setUser(data.user);
        setToken(tokenToVerify);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', tokenToVerify);
        applyTheme(data.user?.theme || 'light');
        setIsLoading(false);
        return true;
      }
    } catch (error) {
      console.error('Token verification failed:', error);
    }
    
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    applyTheme('light');
    setIsLoading(false);
    return false;
  };

  const login = async (email, password, totpCode) => {
    try {
      const data = await apiPost('/api/auth/login', { email, password, ...(totpCode ? { totp_code: totpCode } : {}) });
      if (data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        applyTheme(data.user?.theme || 'light');
        return { success: true, user: data.user };
      }
      if (data.requires2fa && data.tempToken) {
        return { success: false, requires2fa: true, tempToken: data.tempToken };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Network error. Please check if the backend is running.' };
    }
  };

  const verify2FA = async (tempToken, code) => {
    try {
      const data = await apiPost('/api/auth/2fa/login-verify', { tempToken, code });
      if (data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        applyTheme(data.user?.theme || 'light');
        return { success: true, user: data.user };
      }
      return { success: false, error: data.error || '2FA verification failed' };
    } catch (error) {
      console.error('2FA verify error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    applyTheme('light');
  };

  const updateUser = (updates) => {
    if (user) {
      const updated = { ...user, ...updates };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  };

  const setTheme = async (theme) => {
    if (!user || !['light', 'dark'].includes(theme)) return;
    try {
      await apiPut('/api/users/me', { theme });
      updateUser({ theme });
      applyTheme(theme);
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const value = useMemo(() => ({
    user,
    updateUser,
    setTheme,
    token,
    login,
    verify2FA,
    logout,
    isLoading,
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
  }), [user, token, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

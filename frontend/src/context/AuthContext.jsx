import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gg_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gg_token');
    if (token) {
      authAPI.me()
        .then(res => { setUser(res.data.user); localStorage.setItem('gg_user', JSON.stringify(res.data.user)); })
        .catch(() => { localStorage.removeItem('gg_token'); localStorage.removeItem('gg_user'); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('gg_token', token);
    localStorage.setItem('gg_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('gg_token');
    localStorage.removeItem('gg_user');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await authAPI.me();
      setUser(res.data.user);
      localStorage.setItem('gg_user', JSON.stringify(res.data.user));
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser, isAdmin: user?.role === 'admin', isActive: user?.subscription_status === 'active' || user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = Cookies.get('admin_user');
    if (stored) {
      try {
        setAdmin(JSON.parse(stored));
      } catch {
        Cookies.remove('admin_user');
        Cookies.remove('admin_token');
      }
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const data = await api.post('/admin/login', { email, password });
    Cookies.set('admin_token', data.token, { expires: 1 });
    Cookies.set('admin_user', JSON.stringify(data.admin), { expires: 1 });
    setAdmin(data.admin);
    router.push('/');
  }

  function logout() {
    Cookies.remove('admin_token');
    Cookies.remove('admin_user');
    setAdmin(null);
    router.push('/login');
  }

  function hasRole(...roles) {
    return admin && roles.includes(admin.role);
  }

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

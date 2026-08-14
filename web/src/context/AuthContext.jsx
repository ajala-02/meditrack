import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      const token = localStorage.getItem('meditrack-token');
      if (token) {
        window.__accessToken = token;
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        setIsAuthenticated(true);
      }
    } catch {
      localStorage.removeItem('meditrack-token');
      window.__accessToken = null;
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password, joinCode) => {
    const { data } = await api.post('/auth/login', { email, password, joinCode });
    localStorage.setItem('meditrack-token', data.accessToken);
    window.__accessToken = data.accessToken;
    setUser(data.user);
    setIsAuthenticated(true);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    localStorage.removeItem('meditrack-token');
    window.__accessToken = null;
    setUser(null);
    setIsAuthenticated(false);
  };

  const refresh = async () => {
    try {
      const { data } = await api.post('/auth/refresh', {});
      localStorage.setItem('meditrack-token', data.accessToken);
      window.__accessToken = data.accessToken;
    } catch {
      localStorage.removeItem('meditrack-token');
      window.__accessToken = null;
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

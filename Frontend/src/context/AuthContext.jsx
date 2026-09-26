import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục phiên đăng nhập từ localStorage khi reload trang
  useEffect(() => {
    const savedToken = localStorage.getItem('mediclinic_token');
    const savedUser = localStorage.getItem('mediclinic_user');

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Lỗi phân tích dữ liệu user từ local storage:', err);
        localStorage.removeItem('mediclinic_token');
        localStorage.removeItem('mediclinic_user');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Đăng nhập
   */
  const login = async (email, password) => {
    const res = await axiosClient.post('/auth/login', { email, password });
    if (res.success && res.data) {
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);

      localStorage.setItem('mediclinic_token', receivedToken);
      localStorage.setItem('mediclinic_user', JSON.stringify(receivedUser));
      return receivedUser;
    }
    throw new Error(res.message || 'Đăng nhập thất bại.');
  };

  /**
   * Đăng ký
   */
  const register = async (userData) => {
    const res = await axiosClient.post('/auth/register', userData);
    if (res.success && res.data) {
      const { token: receivedToken, user: receivedUser } = res.data;
      setToken(receivedToken);
      setUser(receivedUser);

      localStorage.setItem('mediclinic_token', receivedToken);
      localStorage.setItem('mediclinic_user', JSON.stringify(receivedUser));
      return receivedUser;
    }
    throw new Error(res.message || 'Đăng ký thất bại.');
  };

  /**
   * Đăng xuất
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('mediclinic_token');
    localStorage.removeItem('mediclinic_user');
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider.');
  }
  return context;
};

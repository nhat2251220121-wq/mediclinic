import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { socket } from '../api/socket';

const AuthContext = createContext(null);
const SESSION_TOKEN_KEY = 'mediclinic_token';
const SESSION_USER_KEY = 'mediclinic_user';
const VALID_ROLES = new Set(['ADMIN', 'DOCTOR', 'PATIENT']);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  // Invalidates profile/login responses started by a session that has since changed.
  const sessionRevision = useRef(0);

  const clearSession = useCallback(() => {
    sessionRevision.current += 1;
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    setUser(null);
    setToken(null);
    socket.disconnect();
    socket.auth = {};
  }, []);

  const applySession = useCallback((receivedUser, receivedToken) => {
    if (!receivedToken || !receivedUser?.id || !VALID_ROLES.has(receivedUser.role)) {
      throw new Error('Thông tin phiên đăng nhập hoặc vai trò tài khoản không hợp lệ.');
    }

    // Socket.IO does not replace credentials on an already-connected socket.
    // Disconnect first so the next connection authenticates as this account.
    socket.disconnect();
    localStorage.setItem(SESSION_TOKEN_KEY, receivedToken);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(receivedUser));
    socket.auth = { token: receivedToken };
    setUser(receivedUser);
    setToken(receivedToken);
    socket.connect();
    return receivedUser;
  }, []);

  // Restore a session from the server, not from potentially stale cached user data.
  useEffect(() => {
    const revision = ++sessionRevision.current;
    const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
    if (!savedToken) {
      localStorage.removeItem(SESSION_USER_KEY);
      socket.disconnect();
      socket.auth = {};
      setLoading(false);
      return undefined;
    }

    setToken(savedToken);
    axiosClient.get('/auth/profile')
      .then((res) => {
        if (revision !== sessionRevision.current) return;
        if (!res.success || !res.data) throw new Error('Phiên đăng nhập không hợp lệ.');
        applySession(res.data, savedToken);
      })
      .catch(() => {
        if (revision !== sessionRevision.current) return;
        clearSession();
        setLoading(false);
      })
      .finally(() => {
        if (revision === sessionRevision.current) setLoading(false);
      });

    return () => {
      if (revision === sessionRevision.current) sessionRevision.current += 1;
    };
  }, [applySession, clearSession]);

  // Axios dispatches this only when a 401 belongs to the token currently active.
  useEffect(() => {
    const handleSessionExpired = (event) => {
      const expiredToken = event.detail?.token;
      if (expiredToken && expiredToken === localStorage.getItem(SESSION_TOKEN_KEY)) clearSession();
    };
    window.addEventListener('mediclinic:session-expired', handleSessionExpired);
    return () => window.removeEventListener('mediclinic:session-expired', handleSessionExpired);
  }, [clearSession]);

  const login = async (identifier, password) => {
    const revision = ++sessionRevision.current;
    const res = await axiosClient.post('/auth/login', { email: identifier, password });
    if (revision !== sessionRevision.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    if (res.success && res.data) {
      const { token: receivedToken, user: receivedUser } = res.data;
      return applySession(receivedUser, receivedToken);
    }
    throw new Error(res.message || 'Đăng nhập thất bại.');
  };

  const register = async (userData) => {
    const revision = ++sessionRevision.current;
    const res = await axiosClient.post('/auth/register', userData);
    if (revision !== sessionRevision.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    if (res.success && res.data) {
      const { token: receivedToken, user: receivedUser } = res.data;
      return applySession(receivedUser, receivedToken);
    }
    throw new Error(res.message || 'Đăng ký thất bại.');
  };

  const updateProfile = async (profile) => {
    const revision = sessionRevision.current;
    const res = await axiosClient.patch('/auth/profile', profile);
    if (revision !== sessionRevision.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải lại hồ sơ.');
    if (!res.success || !res.data || !VALID_ROLES.has(res.data.role)) throw new Error(res.message || 'Không lưu được hồ sơ.');
    setUser(res.data);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(res.data));
    return res.data;
  };

  const refreshProfile = async () => {
    const revision = sessionRevision.current;
    const res = await axiosClient.get('/auth/profile');
    if (revision !== sessionRevision.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng tải lại hồ sơ.');
    if (!res.success || !res.data || !VALID_ROLES.has(res.data.role)) throw new Error(res.message || 'Không tải được hồ sơ.');
    setUser(res.data);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(res.data));
    return res.data;
  };

  const logout = () => clearSession();

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token && !!user,
    loading,
    login,
    register,
    updateProfile,
    refreshProfile,
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

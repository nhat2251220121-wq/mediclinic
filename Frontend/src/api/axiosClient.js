import axios from 'axios';

// Lấy Base URL từ biến môi trường Vite hoặc mặc định localhost:5000/api
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s cho các tác vụ AI
});

// Request Interceptor: Tự động đính kèm JWT Bearer Token vào mọi request gửi đi
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mediclinic_token');
    if (token) {
      // Keep the request's session identity so a late 401 from an older
      // account cannot clear a newer account's session.
      config.__mediclinicToken = token;
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Xử lý dữ liệu trả về hoặc bắt lỗi toàn cục
axiosClient.interceptors.response.use(
  (response) => {
    // Trả về data trực tiếp để component dùng tiện hơn
    return response.data;
  },
  (error) => {
    if (error.response) {
      // Khi token hết hạn hoặc không hợp lệ (401)
      if (error.response.status === 401) {
        const requestToken = error.config?.__mediclinicToken;
        const currentToken = localStorage.getItem('mediclinic_token');
        const isPublicAuthRequest = /\/auth\/(login|register)(?:\?|$)/.test(error.config?.url || '');
        if (!isPublicAuthRequest && requestToken && requestToken === currentToken) {
          window.dispatchEvent(new CustomEvent('mediclinic:session-expired', { detail: { token: requestToken } }));
        }
        // A stale request from a previous account must not redirect or clear
        // the current account. Login/register 401s are credential errors.
        if (!isPublicAuthRequest && requestToken && requestToken === currentToken
          && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
          window.location.href = '/login?session_expired=1';
        }
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default axiosClient;

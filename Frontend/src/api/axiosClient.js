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
        localStorage.removeItem('mediclinic_token');
        localStorage.removeItem('mediclinic_user');
        // Không redirect nếu đang ở trang login/register
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
          window.location.href = '/login?session_expired=1';
        }
      }
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default axiosClient;

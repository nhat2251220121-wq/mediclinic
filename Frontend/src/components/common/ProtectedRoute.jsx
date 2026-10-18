import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Component bảo vệ Route theo Role
 * @param {Array<string>} allowedRoles Danh sách role được phép truy cập (VD: ['ADMIN', 'DOCTOR'])
 */
const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // 1. Chưa đăng nhập -> Chuyển về trang login kèm đường dẫn gốc
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Đã đăng nhập nhưng không đủ quyền Role -> Chuyển tới trang Unauthorized
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate
      to="/unauthorized"
      state={{ type: 'role-mismatch', actualRole: role, requiredRoles: allowedRoles }}
      replace
    />;
  }

  // 3. Hợp lệ -> Render các route con
  return <Outlet />;
};

export default ProtectedRoute;

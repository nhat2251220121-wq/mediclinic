import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ImageWithFallback from '../common/ImageWithFallback';
import PatientNotificationBell from '../common/PatientNotificationBell';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">Quản Trị Viên</span>;
      case 'DOCTOR':
        return <span className="bg-sky-100 text-sky-700 text-xs px-2 py-0.5 rounded-full font-semibold">Bác Sĩ</span>;
      case 'PATIENT':
        return <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">Bệnh Nhân</span>;
      default:
        return null;
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold bg-gradient-to-r from-sky-600 to-teal-600 bg-clip-text text-transparent">
          MediClinic Portal
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {user?.role === 'PATIENT' && <PatientNotificationBell />}

        <div className="h-8 w-px bg-slate-200"></div>

        <div className="flex items-center gap-3">
          <ImageWithFallback src={user?.avatar_url} alt={user?.full_name} className="w-9 h-9 rounded-full border border-sky-200 object-cover" fallback={<span className="font-bold text-sm">{user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}</span>} />
          <div className="text-left hidden sm:block">
            <div className="text-sm font-semibold text-slate-800 leading-tight">{user?.full_name}</div>
            <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Đăng xuất"
          className="flex items-center gap-1.5 text-xs text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};

export default Header;

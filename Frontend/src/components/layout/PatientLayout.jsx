import React from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldPlus, Bot, ChevronDown, User, History, LogOut } from 'lucide-react';
import AIChatWidget from '../common/AIChatWidget';
import PatientNotificationBell from '../common/PatientNotificationBell';

const PatientLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar - giống trang chủ, không có sidebar */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl h-full mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-sky-600/30">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-lg text-sky-700 tracking-tight leading-none">MediClinic</h1>
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Hệ thống Y tế thông minh</span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <Link to="/" className="hover:text-sky-600 transition">Dịch vụ y tế</Link>
            <Link to="/#about" className="hover:text-sky-600 transition">Giới thiệu phòng khám</Link>
          </nav>

          {/* User Dropdown */}
          <div className="flex items-center gap-2">
            <PatientNotificationBell />
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition"
            >
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-200">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name}</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Bệnh nhân</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                  <Link
                    to="/patient/history"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                  >
                    <History className="w-4 h-4 text-sky-600" />
                    <span>Lịch sử khám bệnh</span>
                  </Link>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* AI Chat Widget */}
      <AIChatWidget />
    </div>
  );
};

export default PatientLayout;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, History, LogOut, ShieldPlus, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PatientNotificationBell from '../common/PatientNotificationBell';
import ImageWithFallback from '../common/ImageWithFallback';

const PublicSiteHeader = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const navigate = useNavigate();

  const roleLabel = {
    ADMIN: 'Quản trị viên',
    DOCTOR: 'Bác sĩ',
    PATIENT: 'Bệnh nhân'
  }[user?.role] || 'Tài khoản';

  const handleLogout = () => {
    logout();
    setAccountMenuOpen(false);
    navigate('/login');
  };

  const accountPath = user?.role === 'PATIENT'
    ? '/patient/history'
    : user?.role === 'DOCTOR'
      ? '/doctor/profile'
      : user?.role === 'ADMIN'
        ? '/admin/dashboard'
        : null;
  const accountActionLabel = user?.role === 'PATIENT'
    ? 'Lịch sử khám bệnh'
    : user?.role === 'DOCTOR'
      ? 'Hồ sơ của tôi'
      : 'Trang quản trị';

  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
    <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-5 lg:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="MediClinic - Trang chủ">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 text-white">
          <ShieldPlus className="h-5 w-5" />
        </span>
        <span className="leading-tight">
          <span className="block text-base font-semibold tracking-tight text-slate-800">MediClinic</span>
          <span className="hidden text-[10px] font-medium text-slate-500 sm:block">Hệ thống Y tế thông minh</span>
        </span>
      </Link>

      <nav aria-label="Điều hướng công khai" className="flex min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto px-1 text-[11px] font-medium text-slate-600 sm:gap-5 sm:text-sm">
        <Link to="/#services" className="whitespace-nowrap transition-colors hover:text-sky-700">Dịch vụ y tế</Link>
        <Link to="/about" className="whitespace-nowrap transition-colors hover:text-sky-700">Giới thiệu phòng khám</Link>
        <Link to="/about#specialties" className="whitespace-nowrap transition-colors hover:text-sky-700">Chuyên khoa</Link>
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {user?.role === 'PATIENT' && <PatientNotificationBell />}
        {isAuthenticated ? <div className="relative">
          <button type="button" aria-expanded={accountMenuOpen} aria-haspopup="menu" onClick={() => setAccountMenuOpen((open) => !open)} className="flex max-w-[12rem] items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-slate-100 sm:max-w-[15rem] sm:gap-2">
            <ImageWithFallback src={user?.avatar_url} alt={user?.full_name || 'Ảnh tài khoản'} className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover sm:h-9 sm:w-9" fallback={<span className="text-sm font-semibold text-teal-800">{user?.full_name?.trim()?.charAt(0)?.toUpperCase() || <User className="h-4 w-4" />}</span>} />
            <span className="hidden min-w-0 text-left sm:block"><span className="block max-w-36 truncate text-xs font-semibold text-slate-800">{user?.full_name || 'Tài khoản'}</span><span className="mt-0.5 block text-[10px] text-slate-500">{roleLabel}</span></span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {accountMenuOpen && <>
            <button type="button" aria-label="Đóng menu tài khoản" className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountMenuOpen(false)} />
            <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-800">{user?.full_name || 'Tài khoản'}</p>
                <p className="mt-0.5 text-xs text-slate-500">{roleLabel}</p>
              </div>
              {accountPath && <Link role="menuitem" to={accountPath} onClick={() => setAccountMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                {user?.role === 'PATIENT' ? <History className="h-4 w-4 text-teal-700" /> : <User className="h-4 w-4 text-teal-700" />}
                {accountActionLabel}
              </Link>}
              <div className="border-t border-slate-100 pt-1">
                <button type="button" role="menuitem" onClick={handleLogout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"><LogOut className="h-4 w-4" />Đăng xuất</button>
              </div>
            </div>
          </>}
        </div> : <>
          <Link to="/login" className="whitespace-nowrap px-2 py-2 text-[11px] font-semibold text-slate-600 transition-colors hover:text-sky-700 sm:px-3 sm:text-xs">Đăng nhập</Link>
          <Link to="/register" className="whitespace-nowrap rounded-lg bg-sky-700 px-2.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-sky-800 sm:px-3 sm:text-xs">Đăng ký</Link>
        </>}
      </div>
    </div>
  </header>;
};

export default PublicSiteHeader;

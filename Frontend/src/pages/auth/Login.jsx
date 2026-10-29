import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldPlus, Phone, Lock, AlertCircle, LogIn, ArrowRight } from 'lucide-react';
import AIChatWidget from '../../components/common/AIChatWidget';

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || null;

  const getRoleHome = (role) => ({
    ADMIN: '/admin/dashboard',
    DOCTOR: '/doctor/queue',
    PATIENT: '/'
  }[role] || null);

  const getRoleSafePath = (role, path) => {
    if (typeof path !== 'string' || !path.startsWith('/')) return null;
    try {
      const destination = new URL(path, window.location.origin);
      if (destination.origin !== window.location.origin) return null;
      const pathname = destination.pathname;
      const isWithin = (root) => pathname === root || pathname.startsWith(`${root}/`);
      const allowed = role === 'ADMIN'
        ? isWithin('/admin')
        : role === 'DOCTOR'
          ? isWithin('/doctor')
          : role === 'PATIENT'
            ? pathname === '/' || isWithin('/patient')
            : false;
      return allowed ? `${pathname}${destination.search}` : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Backend hỗ trợ email hoặc số điện thoại
      const user = await login(phoneNumber, password);
      const roleHome = getRoleHome(user?.role);
      if (!roleHome) throw new Error('Tài khoản chưa có vai trò hợp lệ. Vui lòng liên hệ quản trị viên.');
      const requestedPath = from?.pathname
        ? `${from.pathname}${typeof from.search === 'string' ? from.search : ''}`
        : null;
      const destination = getRoleSafePath(user.role, requestedPath) || roleHome;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Số điện thoại hoặc mật khẩu không chính xác.');
    } finally {
      setSubmitting(false);
    }
  };



  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-8 space-y-6 animate-fadeIn">
        {/* Logo & Tiêu đề theo Hình 3.12 */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md shadow-sky-600/30">
            <ShieldPlus className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Đăng nhập</h2>
          <p className="text-xs text-slate-500">Hệ thống Quản lý Phòng khám & Đặt lịch khám</p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              * Số điện thoại / Email
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0912325678 hoặc email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-600">* Mật khẩu</label>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 text-sm tracking-wider uppercase"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>ĐĂNG NHẬP</span>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Bạn chưa có tài khoản?{' '}
          <Link to="/register" className="text-sky-600 font-bold hover:underline">
            Đăng ký
          </Link>
        </p>
      </div>

      <AIChatWidget />
    </div>
  );
};

export default Login;

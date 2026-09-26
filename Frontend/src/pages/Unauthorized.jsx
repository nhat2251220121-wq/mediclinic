import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const Unauthorized = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Không Có Quyền Truy Cập (403)</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Tài khoản của bạn không được phân quyền để truy cập vào khu vực này. Vui lòng liên hệ Quản trị viên hoặc quay lại trang chủ.
        </p>
        <div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang đăng nhập</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;

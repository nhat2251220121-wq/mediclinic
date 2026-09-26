import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <FileQuestion className="w-9 h-9" />
        </div>
        <h2 className="text-3xl font-black text-slate-800">404</h2>
        <p className="text-base font-semibold text-slate-700">Trang không tồn tại</p>
        <p className="text-sm text-slate-500">
          Đường dẫn bạn yêu cầu không tìm thấy trên hệ thống MediClinic.
        </p>
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 transition-colors shadow-md shadow-sky-600/20"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

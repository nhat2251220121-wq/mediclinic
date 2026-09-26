import React, { useState } from 'react';
import { Calendar, Users, Activity, TrendingUp, Clock, Stethoscope, ChevronDown } from 'lucide-react';

const Dashboard = () => {
  const [dateRange, setDateRange] = useState('01/10/2025 - 19/10/2025');

  // Dữ liệu biểu đồ cột Số ca khám theo ngày (Hình 3.1)
  const barData = [
    { day: '01/10', count: 18 },
    { day: '02/10', count: 25 },
    { day: '03/10', count: 32 },
    { day: '04/10', count: 16 },
    { day: '05/10', count: 28 },
    { day: '06/10', count: 22 },
    { day: '07/10', count: 26 },
    { day: '08/10', count: 12 },
    { day: '09/10', count: 18 },
    { day: '10/10', count: 24 },
    { day: '11/10', count: 30 },
    { day: '12/10', count: 14 },
    { day: '13/10', count: 20 },
    { day: '14/10', count: 25 },
    { day: '15/10', count: 35 },
    { day: '16/10', count: 19 },
    { day: '17/10', count: 28 },
    { day: '18/10', count: 22 },
    { day: '19/10', count: 31 },
  ];

  const maxCount = Math.max(...barData.map(d => d.count));

  // Dữ liệu biểu đồ tròn phân bổ theo phòng ban (Hình 3.1)
  const departments = [
    { name: 'Sơ sinh / Nhi', percentage: 37, color: 'bg-amber-500', hex: '#f59e0b' },
    { name: 'Tiêu hóa nội', percentage: 24, color: 'bg-purple-600', hex: '#9333ea' },
    { name: 'Răng hàm mặt', percentage: 16, color: 'bg-sky-500', hex: '#0ea5e9' },
    { name: 'Tai mũi họng', percentage: 14, color: 'bg-teal-500', hex: '#14b8a6' },
    { name: 'Nội tổng quát', percentage: 9, color: 'bg-rose-500', hex: '#f43f5e' },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Date Range Picker (Hình 3.1) */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tổng quan phòng khám</h2>
          <p className="text-xs text-slate-500 mt-0.5">Báo cáo phân tích hoạt động và khám bệnh MediClinic</p>
        </div>

        {/* Khung chọn ngày góc phải (Hình 3.1) */}
        <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 shadow-sm cursor-pointer hover:bg-slate-100 transition">
          <Calendar className="w-4 h-4 text-sky-600" />
          <span>{dateRange}</span>
          <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />
        </div>
      </div>

      {/* 3 THẺ CHỈ SỐ KPI CHÍNH (HÌNH 3.1 TRÊN) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Số ca khám: 311 */}
        <div className="bg-sky-50/70 border border-sky-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Tổng số ca khám</span>
            <div className="text-4xl font-black text-sky-950 mt-1">311</div>
            <span className="text-[11px] text-sky-600 font-semibold">Tăng 12% so với tháng trước</span>
          </div>
          <div className="w-12 h-12 bg-sky-200/60 text-sky-700 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Tỷ lệ tái khám: 22% */}
        <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Tỷ lệ tái khám</span>
            <div className="text-4xl font-black text-amber-950 mt-1">22%</div>
            <span className="text-[11px] text-amber-700 font-semibold">Đạt chỉ tiêu đề ra</span>
          </div>
          <div className="w-12 h-12 bg-amber-200/60 text-amber-700 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Bác sĩ trực: 5 */}
        <div className="bg-rose-50/70 border border-rose-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Số lượng bác sĩ trực</span>
            <div className="text-4xl font-black text-rose-950 mt-1">5</div>
            <span className="text-[11px] text-rose-600 font-semibold">Đang tiếp nhận bệnh nhân</span>
          </div>
          <div className="w-12 h-12 bg-rose-200/60 text-rose-700 rounded-2xl flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ SỐ CA KHÁM THEO NGÀY & PHÂN BỔ PHÒNG BAN (HÌNH 3.1 DƯỚI) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ cột: Số ca khám theo ngày */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Số ca khám theo ngày</h3>
            <span className="text-xs text-slate-400">Đơn vị: Ca</span>
          </div>

          <div className="h-64 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-100">
            {barData.map((d, idx) => {
              const heightPct = (d.count / maxCount) * 100;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip khi hover */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold pointer-events-none whitespace-nowrap z-10">
                    {d.count} ca
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-sky-500 group-hover:bg-sky-600 rounded-t-md transition-all duration-300"
                  ></div>
                  <span className="text-[9px] text-slate-400 rotate-45 sm:rotate-0 mt-1 origin-left">
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Biểu đồ Donut: Phân bổ ca khám theo phòng ban */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            Phân bổ ca khám theo phòng ban
          </h3>

          {/* Vòng tròn Donut Chart SVG */}
          <div className="relative flex justify-center py-2">
            <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
              <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
              {/* Sơ sinh / Nhi: 37% */}
              <circle
                cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" strokeWidth="18"
                strokeDasharray="88 150" strokeDashoffset="0"
              />
              {/* Tiêu hóa nội: 24% */}
              <circle
                cx="50" cy="50" r="38" fill="transparent" stroke="#9333ea" strokeWidth="18"
                strokeDasharray="57 181" strokeDashoffset="-88"
              />
              {/* Răng hàm mặt: 16% */}
              <circle
                cx="50" cy="50" r="38" fill="transparent" stroke="#0ea5e9" strokeWidth="18"
                strokeDasharray="38 200" strokeDashoffset="-145"
              />
              {/* Tai mũi họng: 14% */}
              <circle
                cx="50" cy="50" r="38" fill="transparent" stroke="#14b8a6" strokeWidth="18"
                strokeDasharray="33 205" strokeDashoffset="-183"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400">Tổng</span>
              <span className="text-xl font-black text-slate-800">100%</span>
            </div>
          </div>

          {/* Chú giải (Legend) */}
          <div className="space-y-2 text-xs">
            {departments.map((dept, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${dept.color}`}></span>
                  <span className="text-slate-600 font-medium">{dept.name}</span>
                </div>
                <span className="font-bold text-slate-800">{dept.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Calendar, Users, Activity, TrendingUp, Clock, Stethoscope, ChevronDown, RefreshCw, DollarSign } from 'lucide-react';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalRevenue: 0,
    activeDoctors: 0,
    totalPatients: 0,
    dailyStats: [],
    specialtyStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/dashboard-stats');
      if (res.success) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy thống kê dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const barData = stats.dailyStats;

  const maxCount = Math.max(...barData.map(d => d.count), 1);

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Date Range Picker */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Tổng quan phòng khám</h2>
          <p className="text-xs text-slate-500 mt-0.5">Báo cáo phân tích hoạt động và số liệu trực tuyến MediClinic</p>
        </div>

        <button
          onClick={fetchStats}
          className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 shadow-sm cursor-pointer hover:bg-slate-100 transition"
        >
          <RefreshCw className="w-4 h-4 text-sky-600" />
          <span>Làm mới số liệu</span>
        </button>
      </div>

      {/* 4 THẺ CHỈ SỐ KPI CHÍNH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Số ca khám */}
        <div className="bg-sky-50/70 border border-sky-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Tổng số ca khám</span>
            <div className="text-3xl font-black text-sky-950 mt-1">{loading ? '...' : stats.totalAppointments}</div>
            <span className="text-[11px] text-sky-600 font-semibold">Tất cả ca khám đã đặt</span>
          </div>
          <div className="w-12 h-12 bg-sky-200/60 text-sky-700 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Doanh thu */}
        <div className="bg-emerald-50/70 border border-emerald-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Tổng doanh thu</span>
            <div className="text-2xl font-black text-emerald-950 mt-1">
              {loading ? '...' : `${Number(stats.totalRevenue).toLocaleString()} đ`}
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold">Hóa đơn đã thanh toán</span>
          </div>
          <div className="w-12 h-12 bg-emerald-200/60 text-emerald-700 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Số bệnh nhân */}
        <div className="bg-amber-50/70 border border-amber-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Tổng số bệnh nhân</span>
            <div className="text-3xl font-black text-amber-950 mt-1">{loading ? '...' : stats.totalPatients}</div>
            <span className="text-[11px] text-amber-700 font-semibold">Tài khoản đã đăng ký</span>
          </div>
          <div className="w-12 h-12 bg-amber-200/60 text-amber-700 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Số bác sĩ */}
        <div className="bg-rose-50/70 border border-rose-200 p-6 rounded-3xl space-y-1 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-rose-800">Số bác sĩ chuyên khoa</span>
            <div className="text-3xl font-black text-rose-950 mt-1">{loading ? '...' : stats.activeDoctors}</div>
            <span className="text-[11px] text-rose-600 font-semibold">Đang phục vụ khám</span>
          </div>
          <div className="w-12 h-12 bg-rose-200/60 text-rose-700 rounded-2xl flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ SỐ CA KHÁM THEO NGÀY */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Số ca khám theo ngày</h3>
          <span className="text-xs text-slate-400">Dữ liệu từ MySQL DB</span>
        </div>

        <div className="h-64 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-100 overflow-x-auto">
          {!loading && barData.length === 0 && <p className="w-full text-center text-sm text-slate-500">Chưa có dữ liệu lịch hẹn trong khoảng thống kê.</p>}
          {barData.map((d, idx) => {
            const heightPct = Math.max((d.count / maxCount) * 100, 15);
            return (
              <div key={idx} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group relative">
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold pointer-events-none whitespace-nowrap z-10">
                  {d.count} ca
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full bg-sky-500 group-hover:bg-sky-600 rounded-t-xl transition-all duration-300 flex items-center justify-center text-[10px] text-white font-bold"
                >
                  {d.count}
                </div>
                <span className="text-[10px] font-semibold text-slate-500 mt-1">
                  {d.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

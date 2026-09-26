import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import { Calendar, Search, Filter, RefreshCw, Check, X } from 'lucide-react';

const AppointmentMgmt = () => {
  const [appointments, setAppointments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/appointments');
      if (res.success) {
        setAppointments(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách lịch hẹn:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await axiosClient.patch(`/appointments/${id}/status`, { status });
      fetchAppointments();
    } catch (err) {
      alert('Lỗi cập nhật: ' + (err.message || 'Lỗi'));
    }
  };

  const filtered = appointments.filter(app => {
    const matchStatus = filterStatus === 'ALL' || app.status === filterStatus;
    const matchSearch = app.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        app.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Lịch Hẹn Khám Toàn Hệ Thống</h2>
          <p className="text-sm text-slate-500 mt-1">Duyệt, điều phối và theo dõi lịch khám của tất cả bệnh nhân.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAppointments}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên bệnh nhân hoặc bác sĩ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold">Lọc trạng thái:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xác nhận (PENDING)</option>
            <option value="CONFIRMED">Đã xác nhận (CONFIRMED)</option>
            <option value="COMPLETED">Đã khám xong (COMPLETED)</option>
            <option value="CANCELLED">Đã hủy (CANCELLED)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Mã Lịch</th>
                <th className="py-4 px-6">Bệnh nhân</th>
                <th className="py-4 px-6">Bác sĩ & Phòng khám</th>
                <th className="py-4 px-6">Ngày & Giờ khám</th>
                <th className="py-4 px-6">Chuyên khoa đề xuất (AI)</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải lịch hẹn...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Không tìm thấy lịch hẹn phù hợp.</td>
                </tr>
              ) : (
                filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600">#{app.id}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{app.patient_name}</div>
                      <div className="text-xs text-slate-400">{app.patient_phone || 'Không có SĐT'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800">{app.doctor_name}</div>
                      <div className="text-xs text-slate-400">{app.room_name} ({app.room_number})</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-semibold text-slate-700">{app.appointment_date}</div>
                      <div className="text-xs text-slate-400">{app.time_slot}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                        {app.ai_predicted_specialty || 'Không có'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={app.status} type="appointment" />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {app.status === 'PENDING' && (
                          <button
                            title="Xác nhận lịch hẹn"
                            onClick={() => handleUpdateStatus(app.id, 'CONFIRMED')}
                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {app.status !== 'CANCELLED' && app.status !== 'COMPLETED' && (
                          <button
                            title="Hủy lịch hẹn"
                            onClick={() => handleUpdateStatus(app.id, 'CANCELLED')}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AppointmentMgmt;

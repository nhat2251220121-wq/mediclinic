import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import { Users, Calendar, Clock, Stethoscope, CheckCircle, RefreshCw } from 'lucide-react';

const PatientQueue = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/appointments');
      if (res.success) {
        setAppointments(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy hàng đợi khám:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (appointment) => {
    navigate('/doctor/examination', { state: { appointment } });
  };

  const handleConfirmAppointment = async (id) => {
    try {
      await axiosClient.patch(`/appointments/${id}/status`, { status: 'CONFIRMED' });
      fetchQueue();
    } catch (err) {
      alert('Không thể cập nhật trạng thái: ' + (err.message || 'Lỗi'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Danh Sách Bệnh Nhân Chờ Khám</h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý bệnh nhân đã đặt lịch và tiến hành thăm khám trực tiếp.
          </p>
        </div>
        <button
          onClick={fetchQueue}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Mã Lịch</th>
                <th className="py-4 px-6">Họ tên Bệnh nhân</th>
                <th className="py-4 px-6">Số điện thoại</th>
                <th className="py-4 px-6">Thời gian</th>
                <th className="py-4 px-6">Triệu chứng ban đầu</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải dữ liệu hàng đợi...</td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Hiện chưa có bệnh nhân nào đặt lịch.</td>
                </tr>
              ) : (
                appointments.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600">#{app.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{app.patient_name}</td>
                    <td className="py-4 px-6 text-slate-600">{app.patient_phone || '—'}</td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-semibold text-slate-700">{app.appointment_date}</div>
                      <div className="text-xs text-slate-400">{app.time_slot}</div>
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-slate-600">
                      {app.initial_symptoms || '—'}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={app.status} type="appointment" />
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {app.status === 'PENDING' && (
                          <button
                            onClick={() => handleConfirmAppointment(app.id)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition"
                          >
                            Tiếp nhận
                          </button>
                        )}
                        {app.status !== 'COMPLETED' && app.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleStartExam(app)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Vào khám</span>
                          </button>
                        )}
                        {app.status === 'COMPLETED' && (
                          <span className="text-xs text-emerald-600 font-medium">Đã hoàn tất</span>
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

export default PatientQueue;

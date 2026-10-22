import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import { RefreshCw, Stethoscope } from 'lucide-react';

const PatientQueue = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workDate, setWorkDate] = useState(() => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/appointments');
      if (res.success) {
        setAppointments(res.data);
      }
    } catch (err) {
      setError(err.message || 'Không tải được hàng đợi khám.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = (appointment) => {
    navigate(`/doctor/examination?appointmentId=${appointment.appointment_id}`);
  };

  const visibleAppointments = useMemo(() => appointments.filter((app) => {
    if (String(app.appointment_date).slice(0, 10) !== workDate) return false;
    if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
    const term = search.trim().toLocaleLowerCase('vi');
    return !term || [app.patient_name, app.patient_phone, app.appointment_id].some((value) => String(value || '').toLocaleLowerCase('vi').includes(term));
  }), [appointments, workDate, statusFilter, search]);
  const formatClinicDate = (value) => {
    const raw = String(value || '').slice(0, 10);
    const [year, month, day] = raw.split('-');
    return year && month && day ? `${day}/${month}/${year}` : '—';
  };
  const selectedAppointment = searchParams.get('appointmentId');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Danh Sách Bệnh Nhân Chờ Khám</h2>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý bệnh nhân đã đặt lịch và tiến hành thăm khám trực tiếp.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">Ngày
          <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">Tìm
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, điện thoại, mã lịch" className="w-52 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">Trạng thái
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
            <option value="ALL">Tất cả</option><option value="PENDING">Chờ tiếp nhận</option><option value="CONFIRMED">Đã xác nhận</option><option value="COMPLETED">Đã khám</option><option value="CANCELLED">Đã hủy</option>
          </select>
        </label>
        <button
          onClick={fetchQueue}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới danh sách</span>
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

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
              ) : visibleAppointments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Hiện chưa có bệnh nhân nào đặt lịch.</td>
                </tr>
              ) : (
                visibleAppointments.map((app) => (
                  <tr key={app.id} className={`${String(selectedAppointment) === String(app.appointment_id) ? 'bg-sky-50' : ''} hover:bg-slate-50/60 transition`}>
                    <td className="py-4 px-6 font-semibold text-sky-600">#{app.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{app.patient_name}</td>
                    <td className="py-4 px-6 text-slate-600">{app.patient_phone || '—'}</td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-semibold text-slate-700">{formatClinicDate(app.appointment_date)}</div>
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
                        {app.status === 'CONFIRMED' && (
                          <button
                            onClick={() => handleStartExam(app)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                          >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Vào khám</span>
                          </button>
                        )}
                        {app.status === 'PENDING' && <span className="text-xs text-amber-700">Chờ tiếp nhận</span>}
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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import { CalendarClock, RefreshCw, Stethoscope, UsersRound } from 'lucide-react';

const clinicToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}-${parts.find((part) => part.type === 'day').value}`;
};

const formatClinicDate = (value) => {
  const raw = String(value || '').slice(0, 10);
  const [year, month, day] = raw.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
};

const PatientQueue = () => {
  const [appointments, setAppointments] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workDate, setWorkDate] = useState(clinicToday);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('ARRIVALS');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [appointmentResult, followUpResult] = await Promise.all([
        axiosClient.get('/appointments'),
        axiosClient.get(`/medical-records/follow-ups?date=${encodeURIComponent(workDate)}`)
      ]);
      setAppointments(appointmentResult.data || []);
      setFollowUps(followUpResult.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Không tải được danh sách bệnh nhân.');
    } finally {
      setLoading(false);
    }
  }, [workDate]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const term = search.trim().toLocaleLowerCase('vi');
  const linkedFollowUpAppointmentIds = useMemo(
    () => new Set(followUps.map((item) => Number(item.follow_up_appointment_id)).filter(Boolean)),
    [followUps]
  );
  const arrivalPatients = useMemo(() => appointments.filter((app) => {
    if (String(app.appointment_date).slice(0, 10) !== workDate) return false;
    if (!['PENDING', 'CONFIRMED'].includes(app.status)) return false;
    if (linkedFollowUpAppointmentIds.has(Number(app.appointment_id))) return false;
    if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
    return !term || [app.patient_name, app.patient_phone, app.appointment_id, app.service_name].some((value) => String(value || '').toLocaleLowerCase('vi').includes(term));
  }), [appointments, workDate, statusFilter, term, linkedFollowUpAppointmentIds]);
  const visibleFollowUps = useMemo(() => followUps.filter((item) => {
    const status = item.follow_up_appointment_status || 'NO_BOOKING';
    if (statusFilter !== 'ALL' && statusFilter !== status) return false;
    return !term || [item.patient_name, item.patient_phone, item.follow_up_id, item.source_appointment_id, item.service_name].some((value) => String(value || '').toLocaleLowerCase('vi').includes(term));
  }), [followUps, statusFilter, term]);

  const selectedAppointment = searchParams.get('appointmentId');
  const openAppointment = (id) => navigate(`/doctor/examination?appointmentId=${id}`);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Danh sách bệnh nhân</h2>
            <p className="mt-1 text-sm text-slate-500">Tách lịch cần tiếp nhận khỏi các ngày tái khám bác sĩ đã chỉ định.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">Ngày
              <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">Tìm
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, điện thoại, mã lịch" className="w-52 rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">Trạng thái
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
                <option value="ALL">Tất cả</option>
                {activeTab === 'ARRIVALS' ? <><option value="PENDING">Chờ tiếp nhận</option><option value="CONFIRMED">Đã xác nhận</option></> : <><option value="NO_BOOKING">Chưa đặt lịch mới</option><option value="PENDING">Lịch mới chờ xác nhận</option><option value="CONFIRMED">Lịch mới đã xác nhận</option></>}
              </select>
            </label>
            <button type="button" onClick={fetchQueue} className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
              <RefreshCw className="h-4 w-4" /> Làm mới
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4" role="tablist" aria-label="Nhóm bệnh nhân">
          <button type="button" role="tab" aria-selected={activeTab === 'ARRIVALS'} onClick={() => { setActiveTab('ARRIVALS'); setStatusFilter('ALL'); }} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'ARRIVALS' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <UsersRound className="h-4 w-4" /> Bệnh nhân đến khám <span className="rounded-full bg-white/20 px-2 text-xs">{arrivalPatients.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'FOLLOW_UP'} onClick={() => { setActiveTab('FOLLOW_UP'); setStatusFilter('ALL'); }} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'FOLLOW_UP' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            <CalendarClock className="h-4 w-4" /> Bệnh nhân tái khám <span className="rounded-full bg-white/20 px-2 text-xs">{visibleFollowUps.length}</span>
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="px-5 py-4">Mã</th><th className="px-5 py-4">Bệnh nhân</th><th className="px-5 py-4">Điện thoại</th><th className="px-5 py-4">Ngày / giờ</th><th className="px-5 py-4">Dịch vụ</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4 text-center">Thao tác</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? <tr><td colSpan="7" className="py-8 text-center text-slate-400">Đang tải danh sách...</td></tr>
                : activeTab === 'ARRIVALS' ? arrivalPatients.length === 0 ? <tr><td colSpan="7" className="py-8 text-center text-slate-400">Không có bệnh nhân cần tiếp nhận trong ngày này.</td></tr> : arrivalPatients.map((app) => <tr key={app.appointment_id} className={`${String(selectedAppointment) === String(app.appointment_id) ? 'bg-sky-50' : ''} hover:bg-slate-50/60`}>
                  <td className="px-5 py-4 font-semibold text-sky-700">#{app.appointment_id}</td><td className="px-5 py-4 font-semibold text-slate-800">{app.patient_name}</td><td className="px-5 py-4 text-slate-600">{app.patient_phone || '—'}</td><td className="px-5 py-4"><div>{formatClinicDate(app.appointment_date)}</div><div className="text-xs text-slate-500">{app.time_slot || '—'}</div></td><td className="px-5 py-4">{app.service_name || 'Khám tổng quát'}</td><td className="px-5 py-4"><StatusBadge status={app.status} type="appointment" /></td><td className="px-5 py-4 text-center">{app.status === 'CONFIRMED' ? <button type="button" onClick={() => openAppointment(app.appointment_id)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"><Stethoscope className="h-3.5 w-3.5" />Vào khám</button> : <span className="text-xs text-amber-700">Chờ tiếp nhận</span>}</td>
                </tr>)
                : visibleFollowUps.length === 0 ? <tr><td colSpan="7" className="py-8 text-center text-slate-400">Không có lịch tái khám được chỉ định trong ngày này.</td></tr> : visibleFollowUps.map((item) => <tr key={item.follow_up_id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-semibold text-teal-700">#{item.follow_up_id}</td><td className="px-5 py-4 font-semibold text-slate-800">{item.patient_name}</td><td className="px-5 py-4 text-slate-600">{item.patient_phone || '—'}</td><td className="px-5 py-4"><div>{formatClinicDate(item.follow_up_date)}</div><div className="text-xs text-slate-500">{item.follow_up_time_slot || (item.follow_up_appointment_id ? 'Chưa rõ giờ' : 'Chưa đặt lịch mới')}</div></td><td className="px-5 py-4">{item.service_name || 'Tái khám'}</td><td className="px-5 py-4">{item.follow_up_appointment_id ? <StatusBadge status={item.follow_up_appointment_status} type="appointment" /> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Bác sĩ hẹn · chưa có lịch mới</span>}</td><td className="px-5 py-4 text-center"><button type="button" onClick={() => openAppointment(item.source_appointment_id)} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white"><Stethoscope className="h-3.5 w-3.5" />Mở hồ sơ gần nhất</button></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>
      {activeTab === 'FOLLOW_UP' && <p className="text-xs text-slate-500">Ngày tái khám là chỉ định trong hồ sơ. Nếu chưa có lịch mới, hệ thống chỉ hiển thị lời hẹn, không tự tạo lịch hoặc khung giờ.</p>}
    </div>
  );
};

export default PatientQueue;

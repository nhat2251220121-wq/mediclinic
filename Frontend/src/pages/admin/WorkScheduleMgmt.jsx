import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, Filter, RefreshCw, UserRound, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const clinicDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const clinicNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}:${value('second')}` };
};

const addDays = (date, days) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const statusLabels = {
  AVAILABLE: { label: 'Còn nhận đặt lịch', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  BOOKED: { label: 'Đã có lịch', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  OFF: { label: 'Ngừng nhận đặt lịch', className: 'border-slate-200 bg-slate-100 text-slate-600' },
  PAST_EMPTY: { label: 'Đã qua · Không có lịch đặt', className: 'border-amber-200 bg-amber-50 text-amber-800' }
};

const appointmentStatuses = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  COMPLETED: 'Đã khám xong',
  CANCELLED: 'Đã hủy'
};

const WorkScheduleMgmt = () => {
  const today = clinicDate();
  const [filters, setFilters] = useState({ startDate: today, endDate: addDays(today, 6), doctor_id: '', specialty_id: '', status: '' });
  const [doctors, setDoctors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [slots, setSlots] = useState([]);
  const [shiftsWithoutSlots, setShiftsWithoutSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busySlotId, setBusySlotId] = useState(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [appointmentDetail, setAppointmentDetail] = useState(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');
  const [currentTime, setCurrentTime] = useState(clinicNow);
  const loadSequence = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(clinicNow()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loadSlots = useCallback(async (nextFilters = filters) => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setError('');
    setSlots([]);
    setShiftsWithoutSlots([]);
    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value !== ''));
      const result = await axiosClient.get('/admin/work-schedule/slots', { params });
      if (requestId !== loadSequence.current) return;
      if (result.success) {
        setSlots(result.data?.slots || []);
        setShiftsWithoutSlots(result.data?.shiftsWithoutSlots || []);
      } else {
        setError(result.message || 'Không tải được lịch làm.');
      }
    } catch (requestError) {
      if (requestId === loadSequence.current) setError(requestError.message || 'Không tải được lịch làm.');
    } finally { if (requestId === loadSequence.current) setLoading(false); }
  }, [filters]);

  useEffect(() => {
    let current = true;
    Promise.all([axiosClient.get('/admin/doctors'), axiosClient.get('/admin/specialties')])
      .then(([doctorResult, specialtyResult]) => {
        if (!current) return;
        setDoctors(doctorResult.data || []);
        setSpecialties(specialtyResult.data || []);
      })
      .catch(() => { if (current) setError('Không tải được danh sách bác sĩ hoặc chuyên khoa.'); });
    loadSlots();
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!selectedAppointmentId) return undefined;
    let current = true;
    setAppointmentLoading(true);
    setAppointmentError('');
    setAppointmentDetail(null);
    axiosClient.get(`/appointments/${selectedAppointmentId}`)
      .then((response) => { if (current) setAppointmentDetail(response.data); })
      .catch((requestError) => { if (current) setAppointmentError(requestError.message || 'Không tải được thông tin lịch hẹn.'); })
      .finally(() => { if (current) setAppointmentLoading(false); });
    return () => { current = false; };
  }, [selectedAppointmentId]);

  const updateSlot = async (slot) => {
    const status = slot.slot_status === 'AVAILABLE' ? 'OFF' : 'AVAILABLE';
    const action = status === 'OFF' ? 'ngừng nhận đặt lịch' : 'mở lại nhận đặt lịch';
    if (!window.confirm(`Bạn có chắc muốn ${action} khung ${slot.start_time}–${slot.end_time} của ${slot.doctor_name} ngày ${formatDate(slot.work_date)}?`)) return;
    setBusySlotId(slot.slot_id);
    setActionError('');
    try {
      await axiosClient.patch(`/admin/work-schedule/slots/${slot.slot_id}/status`, { status });
      await loadSlots();
    } catch (requestError) {
      setActionError(requestError.message || 'Không cập nhật được trạng thái khung giờ.');
    } finally { setBusySlotId(null); }
  };

  const submitFilters = (event) => {
    event.preventDefault();
    loadSlots(filters);
  };

  const getDisplaySlotStatus = (slot) => {
    const hasAppointment = Boolean(slot.appointment_id) || slot.slot_status === 'BOOKED';
    const slotDate = String(slot.work_date).slice(0, 10);
    const slotTime = `${String(slot.start_time).slice(0, 5)}:00`;
    const isPast = slotDate < currentTime.date || (slotDate === currentTime.date && slotTime <= currentTime.time);
    return isPast && !hasAppointment ? 'PAST_EMPTY' : slot.slot_status;
  };

  const groupedDays = [];
  const dayMap = new Map();
  slots.forEach((slot) => {
    const dayKey = String(slot.work_date).slice(0, 10);
    if (!dayMap.has(dayKey)) {
      const day = { date: dayKey, doctors: [], doctorMap: new Map() };
      dayMap.set(dayKey, day);
      groupedDays.push(day);
    }
    const day = dayMap.get(dayKey);
    const doctorKey = String(slot.doctor_id);
    if (!day.doctorMap.has(doctorKey)) {
      const doctor = { id: slot.doctor_id, name: slot.doctor_name, specialty: slot.specialty_name, slots: [] };
      day.doctorMap.set(doctorKey, doctor);
      day.doctors.push(doctor);
    }
    day.doctorMap.get(doctorKey).slots.push(slot);
  });

  const totals = slots.reduce((count, slot) => {
    const displayStatus = getDisplaySlotStatus(slot);
    if (displayStatus === 'BOOKED') count.booked += 1;
    else if (displayStatus === 'AVAILABLE') count.available += 1;
    else if (displayStatus === 'OFF') count.off += 1;
    else count.past += 1;
    return count;
  }, { available: 0, booked: 0, off: 0, past: 0 });

  const closeAppointmentDetail = () => {
    setSelectedAppointmentId(null);
    setAppointmentDetail(null);
    setAppointmentError('');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10 font-sans">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Quản lý lịch làm</h1><p className="mt-1 text-sm text-slate-500">Theo dõi từng khung khám 30 phút đã được hệ thống lưu.</p></div>
        <button type="button" onClick={() => loadSlots()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"><RefreshCw className="h-4 w-4 text-sky-700" />Tải lại</button>
      </header>

      <form onSubmit={submitFilters} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-6">
        <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Ngày bắt đầu</span><input type="date" required value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Ngày kết thúc</span><input type="date" required value={filters.endDate} min={filters.startDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Bác sĩ</span><select value={filters.doctor_id} onChange={(event) => setFilters({ ...filters, doctor_id: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả bác sĩ</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Chuyên khoa</span><select value={filters.specialty_id} onChange={(event) => setFilters({ ...filters, specialty_id: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả chuyên khoa</option>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label>
        <label className="space-y-1 text-xs font-semibold text-slate-600"><span>Trạng thái khung giờ</span><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Tất cả trạng thái</option><option value="AVAILABLE">Còn nhận đặt lịch</option><option value="BOOKED">Đã có lịch</option><option value="OFF">Ngừng nhận đặt lịch</option><option value="PAST_EMPTY">Đã qua · Không có lịch đặt</option></select></label>
        <button type="submit" className="inline-flex items-center justify-center gap-2 self-end rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800"><Filter className="h-4 w-4" />Lọc lịch</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Còn nhận đặt', totals.available, 'border-emerald-200 bg-emerald-50 text-emerald-800'],
          ['Đã có lịch', totals.booked, 'border-sky-200 bg-sky-50 text-sky-800'],
          ['Ngừng nhận', totals.off, 'border-slate-200 bg-slate-100 text-slate-700'],
          ['Đã qua · Không có lịch đặt', totals.past, 'border-amber-200 bg-amber-50 text-amber-800']
        ].map(([label, count, color]) => <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}><div className="text-xs font-semibold">{label}</div><div className="mt-1 text-2xl font-bold">{loading ? '—' : count}</div></div>)}
      </div>

      {actionError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{actionError}</div>}
      {shiftsWithoutSlots.length > 0 && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" /><div><p className="font-semibold">Có {shiftsWithoutSlots.length} ca làm chưa có khung 30 phút được lưu.</p><p className="mt-1">Các ca này chưa thể hiện như khung có thể đặt. Nếu có lịch cũ gắn toàn ca, cần đối chiếu trước khi đồng bộ; lịch đó chưa được chuyển hoặc sửa ở trang này.</p><ul className="mt-2 list-inside list-disc">{shiftsWithoutSlots.slice(0, 8).map((item, index) => <li key={`${item.doctor_id}-${item.work_date}-${index}`}>{formatDate(item.work_date)} · {item.doctor_name} · {item.specialty_name} · {item.shift_name} ({item.start_time}–{item.end_time}){Number(item.active_appointment_count) ? ` · ${item.active_appointment_count} lịch cũ` : ''}</li>)}</ul></div></div></div>}

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1"><h2 className="font-bold text-slate-900">Lịch theo ngày và bác sĩ</h2><span className="text-xs text-slate-500">{loading ? 'Đang tải…' : `${slots.length} khung giờ · ${groupedDays.length} ngày`}</span></div>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</div> : loading ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải khung giờ…</span></div> : groupedDays.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500"><div className="flex flex-col items-center gap-2"><CalendarDays className="h-6 w-6 text-slate-300" />Không có khung giờ trong bộ lọc này.</div></div> : groupedDays.map((day, dayIndex) => {
          const dayTotals = day.doctors.reduce((total, doctor) => {
            doctor.slots.forEach((slot) => {
              const displayStatus = getDisplaySlotStatus(slot);
              if (displayStatus === 'BOOKED') total.booked += 1;
              else if (displayStatus === 'AVAILABLE') total.available += 1;
              else if (displayStatus === 'OFF') total.off += 1;
              else total.past += 1;
            });
            return total;
          }, { available: 0, booked: 0, off: 0, past: 0 });
          return <details key={day.date} open={dayIndex === 0} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-4 hover:bg-slate-100 sm:px-5">
              <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-sky-700" /><div><h3 className="font-bold capitalize text-slate-900">{formatDate(day.date)}</h3><p className="mt-0.5 text-xs text-slate-500">{day.doctors.length} bác sĩ</p></div></div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">Còn nhận {dayTotals.available}</span><span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">Đã có lịch {dayTotals.booked}</span><span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">Ngừng nhận {dayTotals.off}</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">Đã qua {dayTotals.past}</span></div>
            </summary>
            <div className="space-y-3 p-3 sm:p-4">
              {day.doctors.map((doctor) => <details key={doctor.id} className="group/doctor rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 hover:bg-slate-50 sm:px-4">
                  <div><h4 className="font-semibold text-slate-900">{doctor.name}</h4><p className="mt-0.5 text-xs text-slate-500">{doctor.specialty || 'Chưa phân chuyên khoa'} · {doctor.slots.length} khung</p></div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold"><span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{doctor.slots.filter((slot) => getDisplaySlotStatus(slot) === 'AVAILABLE').length} còn nhận</span><span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">{doctor.slots.filter((slot) => getDisplaySlotStatus(slot) === 'BOOKED').length} đã đặt</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{doctor.slots.filter((slot) => getDisplaySlotStatus(slot) === 'OFF').length} ngừng</span><span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{doctor.slots.filter((slot) => getDisplaySlotStatus(slot) === 'PAST_EMPTY').length} đã qua</span></div>
                </summary>
                <div className="grid gap-2 border-t border-slate-100 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {doctor.slots.map((slot) => {
                    const displayStatus = getDisplaySlotStatus(slot);
                    const status = statusLabels[displayStatus] || statusLabels.OFF;
                    const booked = displayStatus === 'BOOKED';
                    const canChange = !booked && displayStatus !== 'PAST_EMPTY';
                    return <article key={slot.slot_id} className={`min-w-0 rounded-xl border p-3 ${status.className}`}>
                      <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-1.5 font-bold"><Clock3 className="h-3.5 w-3.5 flex-shrink-0" /><span>{slot.start_time}–{slot.end_time}</span></div>{booked && slot.appointment_id && <button type="button" onClick={() => setSelectedAppointmentId(slot.appointment_id)} className="rounded-md border border-sky-300 bg-white/80 px-2 py-1 text-[10px] font-bold text-sky-800 hover:bg-white">Xem lịch #{slot.appointment_id}</button>}</div>
                      <div className="mt-2 text-xs font-semibold">{status.label}</div>
                      {booked && <div className="mt-1 text-[11px] opacity-80">Trạng thái lịch hẹn: {appointmentStatuses[slot.appointment_status] || (slot.appointment_id ? 'Chưa xác định' : 'Không tìm thấy lịch liên kết')}</div>}
                      {booked && (slot.patient_name || !slot.appointment_id) && <div className="mt-1 flex items-center gap-1 text-[11px] opacity-80"><UserRound className="h-3 w-3" />{slot.patient_name || 'Chưa tìm thấy lịch liên kết'}</div>}
                      {canChange && <button type="button" disabled={busySlotId === slot.slot_id} onClick={() => updateSlot(slot)} className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border bg-white/80 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${slot.slot_status === 'AVAILABLE' ? 'border-amber-300 text-amber-800 hover:bg-white' : 'border-emerald-300 text-emerald-800 hover:bg-white'}`}>{busySlotId === slot.slot_id ? <RefreshCw className="h-3 w-3 animate-spin" /> : slot.slot_status === 'AVAILABLE' ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}{slot.slot_status === 'AVAILABLE' ? 'Ngừng nhận đặt' : 'Mở lại đặt lịch'}</button>}
                    </article>;
                  })}
                </div>
              </details>)}
            </div>
          </details>;
        })}
      </section>

      {selectedAppointmentId && <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title">
        <button type="button" className="fixed inset-0 bg-slate-950/60" onClick={closeAppointmentDetail} aria-label="Đóng thông tin lịch hẹn" />
        <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-700">Chi tiết lịch hẹn #{selectedAppointmentId}</p><h2 id="appointment-detail-title" className="mt-1 text-lg font-bold text-slate-900">Thông tin lịch hẹn</h2></div><button type="button" onClick={closeAppointmentDetail} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button></div>
          {appointmentLoading ? <div className="py-10 text-center text-sm text-slate-500">Đang tải thông tin lịch hẹn…</div> : appointmentError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{appointmentError}</div> : appointmentDetail && <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Bệnh nhân', appointmentDetail.patient_name], ['Số điện thoại', appointmentDetail.patient_phone],
              ['Ngày giờ', `${formatDate(appointmentDetail.appointment_date)} · ${appointmentDetail.time_slot || 'Chưa cập nhật'}`],
              ['Bác sĩ', appointmentDetail.doctor_name], ['Dịch vụ', appointmentDetail.service_name],
              ['Phòng khám', appointmentDetail.room_name ? `${appointmentDetail.room_name}${appointmentDetail.room_number ? ` (${appointmentDetail.room_number})` : ''}` : null],
              ['Trạng thái lịch hẹn', appointmentStatuses[appointmentDetail.status] || appointmentDetail.status]
            ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-medium text-slate-800">{value || 'Chưa cập nhật'}</p></div>)}
          </div>}
        </div>
      </div>}
    </div>
  );
};

export default WorkScheduleMgmt;

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, RefreshCw, UserRound } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const monthParts = (value) => value.split('-').map(Number);
const monthRange = (value) => {
  const [year, month] = monthParts(value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { startDate: `${value}-01`, endDate: `${value}-${String(lastDay).padStart(2, '0')}`, lastDay };
};
const shiftMonth = (value, amount) => {
  const [year, month] = monthParts(value);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};
const formatDate = (value, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${value}T12:00:00+07:00`));

const slotStatus = {
  AVAILABLE: { label: 'Còn trống', classes: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  BOOKED: { label: 'Đã có lịch', classes: 'border-sky-200 bg-sky-50 text-sky-800' },
  OFF: { label: 'Đã khóa', classes: 'border-slate-200 bg-slate-100 text-slate-600' }
};
const appointmentStatus = {
  PENDING: 'Chờ thanh toán/xác nhận', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Đã khám',
  CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng mặt'
};

export default function DoctorWorkCalendar() {
  const today = clinicToday();
  const navigate = useNavigate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const range = monthRange(month);
    setLoading(true);
    setError('');
    axiosClient.get('/doctors/me/calendar', { params: { startDate: range.startDate, endDate: range.endDate } })
      .then((result) => { if (!cancelled) setDays(result.data || []); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message || 'Không tải được lịch làm việc.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month, reloadToken]);

  const daysByDate = useMemo(() => new Map(days.map((day) => [String(day.work_date).slice(0, 10), day])), [days]);
  const calendarCells = useMemo(() => {
    const [year, monthNumber] = monthParts(month);
    const { lastDay } = monthRange(month);
    const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
    return [
      ...Array(firstWeekday).fill(null),
      ...Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
    ];
  }, [month]);
  const selectedDay = daysByDate.get(selectedDate);

  const changeMonth = (nextMonth) => {
    setMonth(nextMonth);
    if (!nextMonth.startsWith(selectedDate.slice(0, 7))) setSelectedDate(`${nextMonth}-01`);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Lịch làm việc</h1>
          <p className="mt-1 text-sm text-slate-500">Xem các ngày/ca đã đăng ký và lịch hẹn được phân công. Ngày giờ theo Asia/Ho_Chi_Minh.</p>
        </div>
        <button type="button" onClick={() => setReloadToken((value) => value + 1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Tải lại
        </button>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button type="button" aria-label="Tháng trước" onClick={() => changeMonth(shiftMonth(month, -1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <h2 className="flex items-center gap-2 text-sm font-semibold capitalize text-slate-900"><CalendarDays className="h-4 w-4 text-teal-700" />{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2>
            <button type="button" aria-label="Tháng sau" onClick={() => changeMonth(shiftMonth(month, 1))} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(today); }} className="mb-3 w-full rounded-lg bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100">Về hôm nay</button>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label) => <div key={label} className="py-2">{label}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />;
              const hasWork = Boolean(daysByDate.get(date)?.shifts?.length);
              const active = date === selectedDate;
              return <button key={date} type="button" onClick={() => setSelectedDate(date)} aria-pressed={active} aria-label={`${formatDate(date)}${hasWork ? ', có lịch làm' : ', không có lịch làm'}`} className={`relative flex h-10 items-center justify-center rounded-lg text-sm transition ${active ? 'bg-teal-700 font-semibold text-white' : date === today ? 'border border-teal-300 font-semibold text-teal-800 hover:bg-teal-50' : 'text-slate-700 hover:bg-slate-100'}`}>
                {Number(date.slice(-2))}
                {hasWork && <span className={`absolute bottom-1 h-1 w-1 rounded-full ${active ? 'bg-white' : 'bg-teal-600'}`} />}
              </button>;
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-teal-600" /> Ngày đã đăng ký lịch làm</div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="mb-4 border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold capitalize text-slate-900">{formatDate(selectedDate)}</h2>
            <p className="mt-1 text-sm text-slate-500">Lịch đăng ký và lịch hẹn trong ngày</p>
          </div>
          {loading ? <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Đang tải lịch…</p>
            : error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>
              : !selectedDay ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Ngày này bạn chưa đăng ký ca làm việc.</p>
                : <div className="space-y-4">
                  {selectedDay.shifts.map((shift) => (
                    <article key={shift.shift_employee_id} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div><h3 className="font-semibold text-slate-900">{shift.shift_name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Clock3 className="h-4 w-4" />{shift.start_time}–{shift.end_time}</p></div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${shift.shift_status === 'OFF' ? 'bg-slate-100 text-slate-600' : 'bg-teal-50 text-teal-800'}`}>{shift.shift_status === 'OFF' ? 'Ca đã khóa' : 'Ca đã đăng ký'}</span>
                      </div>

                      {shift.slots?.length ? <div className="space-y-2">
                        {shift.slots.map((slot) => {
                          const state = slotStatus[slot.status] || slotStatus.OFF;
                          const appointment = slot.appointment;
                          return <div key={slot.slot_id} className="rounded-lg border border-slate-200 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <strong className="text-sm tabular-nums text-slate-800">{slot.start_time}–{slot.end_time}</strong>
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${state.classes}`}>{state.label}</span>
                            </div>
                            {appointment && <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1.5">
                                  <p className="font-semibold text-slate-900">Lịch #{appointment.appointment_id} · {appointment.patient_name || 'Bệnh nhân'}</p>
                                  <p className="text-slate-600">{appointment.service_name || 'Chưa ghi nhận dịch vụ'} · {appointmentStatus[appointment.status] || appointment.status}</p>
                                  <p className="whitespace-pre-wrap break-words text-slate-600"><span className="font-medium">Triệu chứng ban đầu:</span> {appointment.initial_symptoms?.trim() || 'Chưa ghi nhận'}</p>
                                </div>
                                <button type="button" onClick={() => navigate(`/doctor/examination?appointmentId=${appointment.appointment_id}`)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50"><UserRound className="h-4 w-4" />Xem hồ sơ / lịch sử khám</button>
                              </div>
                            </div>}
                            {slot.status === 'BOOKED' && !appointment && <p className="mt-2 text-xs text-amber-800">Khung được đánh dấu đã đặt nhưng chưa tìm thấy lịch liên kết; vui lòng báo quản trị viên kiểm tra.</p>}
                          </div>;
                        })}
                      </div> : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Ca này chưa có khung 30 phút được lưu.</p>}

                      {shift.legacy_appointments?.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <h4 className="text-sm font-semibold text-amber-900">Lịch cũ chưa gắn khung 30 phút</h4>
                        <div className="mt-2 space-y-2">{shift.legacy_appointments.map((appointment) => <div key={appointment.appointment_id} className="rounded-md bg-white/80 p-3 text-sm text-amber-950">
                          <p className="font-semibold">{appointment.time_slot || `${shift.start_time}–${shift.end_time}`} · Lịch #{appointment.appointment_id} · {appointment.patient_name || 'Bệnh nhân'}</p>
                          <p className="mt-1">{appointment.service_name || 'Chưa ghi nhận dịch vụ'} · {appointmentStatus[appointment.status] || appointment.status}</p>
                          <p className="mt-1 whitespace-pre-wrap break-words"><strong>Triệu chứng ban đầu:</strong> {appointment.initial_symptoms?.trim() || 'Chưa ghi nhận'}</p>
                          <button type="button" onClick={() => navigate(`/doctor/examination?appointmentId=${appointment.appointment_id}`)} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">Xem hồ sơ / lịch sử khám</button>
                        </div>)}</div>
                      </div>}
                    </article>
                  ))}
                </div>}
        </section>
      </div>
    </div>
  );
}

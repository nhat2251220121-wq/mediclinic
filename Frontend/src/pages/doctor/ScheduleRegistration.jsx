import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Layers3, RefreshCw, Save } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const clinicDate = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const mondayOf = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

const addDays = (dateValue, count) => {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};

const formatDate = (dateValue, options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) =>
  new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date(`${dateValue}T12:00:00+07:00`));

const shiftKey = (shiftId) => String(Number(shiftId));

const ScheduleRegistration = () => {
  const today = clinicDate();
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [shifts, setShifts] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [selectedDates, setSelectedDates] = useState(() => new Set());
  const [draft, setDraft] = useState({});
  const [applyShiftIds, setApplyShiftIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const weekEnd = weekDates[6];
  const savedByDate = useMemo(() => {
    const result = new Map();
    for (const item of schedule) {
      const date = String(item.work_date).slice(0, 10);
      if (item.status === 'OFF') continue;
      if (!result.has(date)) result.set(date, []);
      result.get(date).push(Number(item.shift_id));
    }
    return result;
  }, [schedule]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [shiftResult, scheduleResult] = await Promise.all([
        axiosClient.get('/doctors/availability/shifts'),
        axiosClient.get('/doctors/me/schedule')
      ]);
      setShifts(shiftResult.data || []);
      setSchedule(scheduleResult.data || []);
    } catch (requestError) {
      setError(requestError.message || 'Không tải được lịch làm việc.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const initialDraft = {};
    const initialSelected = new Set();
    for (const date of weekDates) {
      const registered = savedByDate.get(date) || [];
      initialDraft[date] = [...registered];
      if (registered.length) initialSelected.add(date);
    }
    setDraft(initialDraft);
    setSelectedDates(initialSelected);
  }, [weekDates, savedByDate]);

  const plannedShifts = (date) => draft[date] || [];
  const selectedForWeek = weekDates.filter((date) => date >= today && selectedDates.has(date));
  const hasChanges = weekDates.some((date) => {
    if (date < today) return false;
    const wanted = selectedDates.has(date) ? plannedShifts(date).map(Number).sort((a, b) => a - b) : [];
    const saved = [...(savedByDate.get(date) || [])].sort((a, b) => a - b);
    return wanted.length !== saved.length || wanted.some((id, index) => id !== saved[index]);
  });

  const changeWeek = (offset) => {
    if (hasChanges && !window.confirm('Bạn có thay đổi chưa lưu trong tuần này. Chuyển tuần và bỏ các thay đổi đó?')) return;
    setMessage('');
    setError('');
    setWeekStart(addDays(weekStart, offset * 7));
  };

  const goToCurrentWeek = () => {
    if (hasChanges && !window.confirm('Bạn có thay đổi chưa lưu trong tuần này. Về tuần hiện tại và bỏ các thay đổi đó?')) return;
    setMessage('');
    setError('');
    setWeekStart(mondayOf(clinicDate()));
  };

  const reloadWeek = () => {
    if (hasChanges && !window.confirm('Bạn có thay đổi chưa lưu. Tải lại sẽ bỏ các thay đổi đó. Tiếp tục?')) return;
    setApplyShiftIds([]);
    load();
  };

  const toggleDate = (date) => {
    if (date < today) return;
    setMessage('');
    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleShift = (date, shiftId) => {
    setMessage('');
    setDraft((current) => {
      const currentIds = current[date] || [];
      const key = shiftKey(shiftId);
      const nextIds = currentIds.some((id) => shiftKey(id) === key)
        ? currentIds.filter((id) => shiftKey(id) !== key)
        : [...currentIds, Number(shiftId)];
      return { ...current, [date]: nextIds };
    });
  };

  const applyShiftsToSelected = () => {
    if (!selectedForWeek.length) return;
    setDraft((current) => {
      const next = { ...current };
      for (const date of selectedForWeek) next[date] = applyShiftIds.map(Number);
      return next;
    });
    setMessage('');
  };

  const save = async () => {
    const days = weekDates.filter((date) => date >= today).map((date) => ({
      work_date: date,
      shift_ids: selectedDates.has(date) ? plannedShifts(date).map(Number) : []
    }));
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await axiosClient.put('/doctors/me/schedule', { days });
      setMessage(result.message || 'Đã lưu lịch làm việc cho tuần này.');
      await load();
    } catch (requestError) {
      const errors = requestError.data?.errors;
      const details = Array.isArray(errors) ? errors.map((item) => {
        const shift = shifts.find((candidate) => Number(candidate.shift_id) === Number(item.shift_id));
        return `${item.work_date ? formatDate(item.work_date, { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'Ngày'}${shift ? ` · ${shift.name}` : ''}: ${item.message}`;
      }).join('\n') : '';
      setError([requestError.message || 'Không lưu được lịch làm việc.', details].filter(Boolean).join('\n'));
    } finally {
      setSaving(false);
    }
  };

  const isPastShift = (date, shift) => {
    if (date !== today) return false;
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const currentTime = formatter.format(new Date());
    return shift.start_time <= currentTime;
  };

  const currentWeekLabel = `${formatDate(weekStart, { day: '2-digit', month: '2-digit' })} – ${formatDate(weekEnd, { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Đăng ký lịch làm việc</h1>
          <p className="mt-1 text-sm text-slate-600">Chọn nhiều ngày, áp dụng ca rồi điều chỉnh riêng từng ngày. Thay đổi chỉ được lưu khi bấm nút lưu.</p>
        </div>
        <button type="button" onClick={reloadWeek} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className="h-4 w-4" /> Tải lại
        </button>
      </header>

      {error && <div role="alert" className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Calendar className="h-5 w-5 text-sky-700" /><h2 className="font-semibold text-slate-900">Tuần {currentWeekLabel}</h2></div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Tuần trước" onClick={() => changeWeek(-1)} className="rounded-lg border p-2 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={goToCurrentWeek} className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">Tuần hiện tại</button>
            <button type="button" aria-label="Tuần sau" onClick={() => changeWeek(1)} className="rounded-lg border p-2 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">Đang tải ca và lịch đã đăng ký…</p> : <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {weekDates.map((date) => {
              const isPast = date < today;
              const checked = selectedDates.has(date);
              const daySaved = schedule.filter((item) => String(item.work_date).slice(0, 10) === date && item.status !== 'OFF');
              const shiftNames = daySaved.map((item) => item.shift_name);
              return <button key={date} type="button" disabled={isPast} onClick={() => toggleDate(date)} aria-pressed={checked}
                className={`min-h-28 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${checked ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600' : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase text-slate-500">{formatDate(date, { weekday: 'long' })}</span>
                  {checked && <Check className="h-4 w-4 text-sky-700" />}
                </span>
                <span className="mt-1 block text-lg font-bold">{formatDate(date, { day: '2-digit', month: '2-digit' })}</span>
                <span className="mt-1 block min-h-4 text-[11px] text-slate-500">{isPast ? 'Đã qua · chỉ xem' : shiftNames.length ? `Đã lưu: ${shiftNames.join(', ')}` : checked ? 'Đang chọn' : 'Chưa đăng ký'}</span>
              </button>;
            })}
          </div>

          {shifts.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Phòng khám chưa cấu hình ca làm.</p> : <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Layers3 className="h-4 w-4 text-sky-700" />Chọn ca để áp dụng cho các ngày đã chọn</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {shifts.map((shift) => {
                  const checked = applyShiftIds.some((id) => shiftKey(id) === shiftKey(shift.shift_id));
                  return <label key={shift.shift_id} className={`flex cursor-pointer items-center gap-2 rounded-lg border bg-white p-3 text-sm ${checked ? 'border-sky-600 text-sky-900' : 'border-slate-200 text-slate-700'}`}>
                    <input type="checkbox" checked={checked} onChange={() => setApplyShiftIds((current) => checked ? current.filter((id) => shiftKey(id) !== shiftKey(shift.shift_id)) : [...current, Number(shift.shift_id)])} className="accent-sky-700" />
                    <span className="flex-1"><span className="block font-medium">{shift.name}</span><span className="text-xs text-slate-500">{shift.start_time}–{shift.end_time}</span></span>
                  </label>;
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Ca được lấy từ cấu hình phòng khám. Có thể chỉnh từng ngày bên dưới.</p>
                <button type="button" disabled={!selectedForWeek.length} onClick={applyShiftsToSelected} className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-800 disabled:opacity-50">Áp dụng cho {selectedForWeek.length} ngày</button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Điều chỉnh ca theo từng ngày</h3>
              {!selectedForWeek.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-slate-500">Chọn một hoặc nhiều ngày trong tuần để đăng ký.</p> : selectedForWeek.map((date) => (
                <div key={date} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2"><h4 className="font-semibold capitalize text-slate-900">{formatDate(date)}</h4><span className="text-xs text-slate-500">{plannedShifts(date).length} ca</span></div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {shifts.map((shift) => {
                      const checked = plannedShifts(date).some((id) => shiftKey(id) === shiftKey(shift.shift_id));
                      const past = isPastShift(date, shift);
                      const saved = schedule.find((item) => String(item.work_date).slice(0, 10) === date && Number(item.shift_id) === Number(shift.shift_id) && item.status !== 'OFF');
                      return <label key={shift.shift_id} className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${checked ? 'border-sky-500 bg-sky-50' : 'border-slate-200'} ${past && !checked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                        <input type="checkbox" checked={checked} disabled={past && !checked} onChange={() => toggleShift(date, shift.shift_id)} className="mt-0.5 accent-sky-700" />
                        <span className="flex-1"><span className="block font-medium text-slate-900">{shift.name}</span><span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3 w-3" />{shift.start_time}–{shift.end_time}</span>{saved && <span className="mt-1 block text-[11px] text-emerald-700">Đã đăng ký · {saved.status === 'FULL' ? 'đã có lịch hẹn' : 'đang mở'}</span>}{past && !checked && <span className="mt-1 block text-[11px] text-amber-700">Ca đã bắt đầu</span>}</span>
                      </label>;
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div aria-live="polite" className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Tóm tắt sẽ đăng ký</h3>
              {!selectedForWeek.length ? <p className="text-sm text-slate-600">Chưa chọn ngày nào.</p> : <ul className="space-y-2 text-sm">
                {selectedForWeek.map((date) => {
                  const names = shifts.filter((shift) => plannedShifts(date).some((id) => shiftKey(id) === shiftKey(shift.shift_id)))
                    .map((shift) => `${shift.name} (${shift.start_time}–${shift.end_time})`);
                  return <li key={date} className="flex flex-wrap justify-between gap-2 border-b border-sky-100 pb-2 last:border-0 last:pb-0">
                    <strong className="capitalize text-slate-800">{formatDate(date)}</strong>
                    <span className="text-slate-600">{names.length ? names.join(' · ') : 'Chưa chọn ca'}</span>
                  </li>;
                })}
              </ul>}
            </div>
          </>}
        </>}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-sm text-slate-600">{hasChanges ? 'Có thay đổi chưa lưu.' : 'Lịch chọn khớp với lịch đã lưu.'}</span>
          <button type="button" disabled={saving || loading || !hasChanges || shifts.length === 0} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50">
            <Save className="h-4 w-4" />{saving ? 'Đang lưu toàn bộ…' : 'Lưu lịch làm việc'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Lịch đã đăng ký trong tuần này</h2>
        {weekDates.flatMap((date) => schedule.filter((item) => String(item.work_date).slice(0, 10) === date && item.status !== 'OFF').map((item) => ({ ...item, displayDate: date }))).length === 0
          ? <p className="text-sm text-slate-600">Tuần này chưa có ca nào được đăng ký.</p>
          : <div className="divide-y divide-slate-100">{weekDates.flatMap((date) => schedule.filter((item) => String(item.work_date).slice(0, 10) === date && item.status !== 'OFF').map((item) => ({ ...item, displayDate: date }))).map((item) => <div key={item.slot_id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium capitalize text-slate-800">{formatDate(item.displayDate)} · {item.shift_name}</span><span className="text-slate-600">{item.start_time}–{item.end_time} · {item.status === 'FULL' ? 'Đã có lịch hẹn' : 'Đang mở đặt lịch'}</span></div>)}</div>}
      </section>
      <p className="text-xs text-slate-500">Ngày được tính theo múi giờ Asia/Ho_Chi_Minh. Bỏ chọn một ngày sẽ gỡ các ca chưa có lịch hẹn; ca có bệnh nhân đặt sẽ khiến toàn bộ lần lưu bị từ chối.</p>
    </div>
  );
};

export default ScheduleRegistration;

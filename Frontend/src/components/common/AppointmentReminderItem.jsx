import React from 'react';
import { Clock3 } from 'lucide-react';

export const reminderTimeLabel = (minutesUntil) => {
  const minutes = Number(minutesUntil);
  if (!Number.isFinite(minutes)) return 'Thời gian chưa xác định';
  if (minutes > 0) return `Còn ${minutes} phút`;
  if (minutes === 0) return 'Đến giờ hẹn';
  return `Quá giờ ${Math.abs(minutes)} phút`;
};

const AppointmentReminderItem = ({ item, compact = false }) => {
  const startTime = String(item.time_slot || '').match(/\b\d{1,2}:\d{2}\b/)?.[0] || '--:--';
  const minutes = Number(item.minutes_until);
  const overdue = Number.isFinite(minutes) && minutes < 0;
  return <article className={`rounded-xl border border-slate-100 bg-white ${compact ? 'p-3' : 'p-3 sm:p-3.5'}`}>
    <div className="flex items-start gap-3">
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold tabular-nums ${overdue ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>
        <Clock3 className="h-4 w-4" />{startTime}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900" title={item.patient_name}>{item.patient_name}</div>
        <div className="mt-0.5 truncate text-xs text-slate-600" title={item.doctor_name}>{item.doctor_name}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500" title={item.service_or_specialty}>{item.service_or_specialty}</div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${overdue ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'}`}>{reminderTimeLabel(item.minutes_until)}</span>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
      <span className="font-medium text-teal-800">Đã xác nhận</span><span>·</span><span>Chưa ghi nhận bệnh nhân đến</span>
    </div>
  </article>;
};

export default AppointmentReminderItem;

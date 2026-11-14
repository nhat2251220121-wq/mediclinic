import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, RefreshCw, X } from 'lucide-react';
import { useAdminAppointmentReminders } from '../../hooks/useAdminAppointmentReminders';
import AppointmentReminderItem from './AppointmentReminderItem';

const AdminAppointmentReminderBell = () => {
  const [open, setOpen] = useState(false);
  const { reminders, loading, error, refresh } = useAdminAppointmentReminders();
  const today = reminders.clinic_date;
  const allTodayUrl = today ? `/admin/appointments?startDate=${today}&endDate=${today}` : '/admin/appointments';

  return <div className="relative">
    <button type="button" aria-label={`Nhắc kiểm tra lịch hẹn: ${reminders.total || 0}`} aria-expanded={open} title="Lịch hẹn sắp đến cần kiểm tra" onClick={() => setOpen((value) => !value)} className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-teal-600">
      <Bell className="h-5 w-5" />
      {Number(reminders.total) > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{reminders.total > 99 ? '99+' : reminders.total}</span>}
    </button>
    {open && <>
      <button type="button" aria-label="Đóng nhắc lịch" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <section role="dialog" aria-label="Lịch hẹn cần kiểm tra" className="absolute right-0 z-50 mt-2 flex max-h-[min(70dvh,34rem)] w-[min(24rem,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0"><h2 className="text-sm font-semibold text-slate-900">Nhắc kiểm tra lịch hẹn</h2><p className="mt-0.5 text-xs text-slate-500">{reminders.total} lịch hôm nay cần kiểm tra</p></div>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={refresh} aria-label="Tải lại lịch nhắc" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {loading && reminders.items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Đang tải lịch hẹn…</p>
            : error ? <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}<button type="button" onClick={refresh} className="ml-2 font-semibold underline">Thử lại</button></div>
              : reminders.items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Hiện không có lịch nào cần kiểm tra.</p>
                : reminders.items.map((item) => <AppointmentReminderItem key={item.appointment_id} item={item} compact />)}
        </div>
        <Link to={allTodayUrl} onClick={() => setOpen(false)} className="inline-flex shrink-0 items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50">
          <CalendarDays className="h-4 w-4" />Xem tất cả lịch hẹn hôm nay
        </Link>
      </section>
    </>}
  </div>;
};

export default AdminAppointmentReminderBell;

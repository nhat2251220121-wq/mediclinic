import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { socket } from '../../api/socket';

const PatientNotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const result = await axiosClient.get('/notifications');
      setItems(result.data || []); setUnread(Number(result.unreadCount || 0)); setError('');
    } catch (requestError) { setError(requestError.message || 'Không tải được thông báo.'); }
  }, []);

  useEffect(() => {
    load();
    socket.on('notifications_updated', load);
    socket.on('connect', load);
    window.addEventListener('focus', load);
    return () => { socket.off('notifications_updated', load); socket.off('connect', load); window.removeEventListener('focus', load); };
  }, [load]);

  const openNotification = async (item) => {
    setOpen(false);
    if (!item.is_read) {
      try { await axiosClient.patch(`/notifications/${item.id}/read`); await load(); }
      catch (requestError) { setError(requestError.message || 'Không đánh dấu được thông báo.'); }
    }
    const target = item.type === 'FOLLOW_UP' && item.appointment_id
      ? `/patient/history?appointmentId=${item.appointment_id}`
      : item.invoice_id ? `/patient/history?invoiceId=${item.invoice_id}` : '/patient/history';
    navigate(target);
  };

  const markAllRead = async () => {
    try { await axiosClient.patch('/notifications/read-all'); await load(); }
    catch (requestError) { setError(requestError.message || 'Không cập nhật được thông báo.'); }
  };

  return <div className="relative">
    <button type="button" title="Thông báo" aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`} onClick={() => setOpen((value) => !value)} className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
      <Bell className="h-5 w-5" />{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <>
      <button type="button" aria-label="Đóng thông báo" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
      <section className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b p-3"><h2 className="font-semibold text-slate-900">Thông báo</h2><button type="button" disabled={!unread} onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-sky-700 disabled:text-slate-400"><CheckCheck className="h-4 w-4" />Đọc tất cả</button></header>
        {error && <p role="alert" className="px-3 py-2 text-xs text-rose-700">{error}</p>}
        <div className="max-h-96 overflow-y-auto">{items.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">Chưa có thông báo.</p> : items.map((item) => <button key={item.id} type="button" onClick={() => openNotification(item)} className={`block w-full min-w-0 border-b px-3 py-3 text-left hover:bg-slate-50 ${!item.is_read ? 'bg-sky-50/70' : ''}`}><span className="flex min-w-0 flex-wrap items-start justify-between gap-x-2 gap-y-1"><strong className="min-w-0 break-words text-sm text-slate-900">{item.title}</strong><span className="shrink-0 text-[10px] text-slate-500">{new Date(item.created_at).toLocaleString('vi-VN')}</span></span><span className="mt-1 block break-words text-xs leading-5 text-slate-600">{item.message}</span><span className="mt-1 block text-[10px] font-semibold uppercase text-sky-700">{item.type === 'FOLLOW_UP' ? 'Lịch tái khám' : item.status === 'ACTION_REQUIRED' ? 'Cần thanh toán' : item.status === 'PAID' ? 'Đã thanh toán' : item.status === 'REVIEW' ? 'Cần đối soát' : 'Đã cập nhật'}</span></button>)}</div>
      </section>
    </>}
  </div>;
};

export default PatientNotificationBell;

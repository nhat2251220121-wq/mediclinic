import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { socket } from '../api/socket';

export const useAdminAppointmentReminders = () => {
  const [reminders, setReminders] = useState({ clinic_date: '', as_of: '', total: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await axiosClient.get('/admin/appointment-reminders');
      if (!response.success) throw new Error('Máy chủ không trả được danh sách lịch cần kiểm tra.');
      setReminders(response.data || { clinic_date: '', as_of: '', total: 0, items: [] });
    } catch (requestError) {
      setError(requestError.message || 'Không tải được lịch hẹn cần kiểm tra.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    const handleUpdate = () => refresh();
    socket.on('appointments_updated', handleUpdate);
    socket.on('payment_updated', handleUpdate);
    socket.on('cancellation_requests_updated', handleUpdate);
    return () => {
      window.clearInterval(interval);
      socket.off('appointments_updated', handleUpdate);
      socket.off('payment_updated', handleUpdate);
      socket.off('cancellation_requests_updated', handleUpdate);
    };
  }, [refresh]);

  return { reminders, loading, error, refresh };
};

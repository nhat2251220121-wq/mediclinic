import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import PaymentModal from '../../components/common/PaymentModal';
import StatusBadge from '../../components/common/StatusBadge';
import { socket } from '../../api/socket';
import { useLocation } from 'react-router-dom';
import { Eye, Calendar, Clock, Stethoscope, Pill, X, Heart, Activity, FileText, Download, ChevronLeft, ChevronRight, QrCode, RefreshCw, Check } from 'lucide-react';

const minutesUntilAppointment = (appointmentDate, timeSlot) => {
  const date = String(appointmentDate || '').slice(0, 10);
  const match = String(timeSlot || '').match(/(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const [year, month, day] = date.split('-').map(Number);
  const startsAtUtc = Date.UTC(year, month - 1, day, Number(match[1]) - 7, Number(match[2]));
  return (startsAtUtc - Date.now()) / 60000;
};

const cancellationStatusText = (request) => {
  if (!request) return '';
  if (request.status === 'PENDING') return 'Đang chờ Admin duyệt';
  if (request.status === 'REJECTED') return 'Bị từ chối';
  if (request.refund_status === 'PENDING') return 'Đã duyệt · Chờ hoàn tiền';
  if (request.refund_status === 'PARTIAL') return 'Đã hoàn một phần';
  if (request.refund_status === 'COMPLETED') return 'Đã hoàn tiền';
  return 'Đã duyệt';
};

const MedicalHistory = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [cancellationRequests, setCancellationRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellationModalItem, setCancellationModalItem] = useState(null);
  const [bankDetailsRequestId, setBankDetailsRequestId] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [refundAccountName, setRefundAccountName] = useState('');
  const [refundBankName, setRefundBankName] = useState('');
  const [refundAccountNumber, setRefundAccountNumber] = useState('');
  const [cancellationError, setCancellationError] = useState('');
  const [cancellationSaving, setCancellationSaving] = useState(false);

  // State cho Modal xem chi tiết
  const [selectedRecord, setSelectedRecord] = useState(null);

  // State cho Modal Thanh Toán VietQR SePay
  const [selectedPaymentApp, setSelectedPaymentApp] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchData();

    // Lắng nghe sự kiện Socket.IO khi thanh toán thành công
    const handlePaymentCompleted = (data) => {
      console.log('⚡ Socket event payment_updated in MedicalHistory:', data);
      fetchData();
    };
    const handleCancellationUpdated = () => {
      setIsPaymentModalOpen(false);
      fetchData();
    };

    socket.on('payment_updated', handlePaymentCompleted);
    socket.on('appointment_cancellation_updated', handleCancellationUpdated);
    return () => {
      socket.off('payment_updated', handlePaymentCompleted);
      socket.off('appointment_cancellation_updated', handleCancellationUpdated);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appRes, invRes, recordRes, cancellationRes] = await Promise.all([
        axiosClient.get('/appointments'),
        axiosClient.get('/invoices'),
        axiosClient.get('/medical-records'),
        axiosClient.get('/appointments/cancellation-requests/mine')
      ]);

      if (appRes.success) setAppointments(appRes.data);
      if (invRes.success) setInvoices(invRes.data);
      if (recordRes.success) setMedicalRecords(recordRes.data || []);
      if (cancellationRes.success) setCancellationRequests(cancellationRes.data || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu lịch sử khám:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const invoiceId = new URLSearchParams(location.search).get('invoiceId');
    if (!invoiceId || loading) return;
    document.getElementById(`invoice-${invoiceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.search, loading, invoices]);

  // Ghép nối thông tin lịch hẹn và hóa đơn tương ứng
  const combinedHistory = appointments.map((app) => {
    const matchedInv = invoices.find(inv => inv.appointment_id === app.id || inv.appointment_id === app.appointment_id);
    const appointmentId = Number(app.appointment_id || app.id);
    const cancellation = cancellationRequests.find((request) => Number(request.appointment_id) === appointmentId) || null;
    return {
      ...app,
      invoice: matchedInv || null,
      medicalRecord: medicalRecords.find((record) => Number(record.appointment_id) === Number(app.appointment_id || app.id)) || null,
      cancellation,
      isPaid: Boolean(matchedInv && Number(matchedInv.amount_due) <= 0 && matchedInv.payment_status === 'PAID')
    };
  });

  useEffect(() => {
    const appointmentId = new URLSearchParams(location.search).get('appointmentId');
    if (!appointmentId || loading) return;
    const index = combinedHistory.findIndex((item) => String(item.appointment_id || item.id) === appointmentId);
    if (index < 0) return;
    setCurrentPage(Math.floor(index / pageSize) + 1);
    setSelectedRecord((current) => current?.id === combinedHistory[index].id ? current : combinedHistory[index]);
    document.getElementById(`appointment-${appointmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [location.search, loading, appointments, invoices, medicalRecords]);

  useEffect(() => {
    const appointmentId = new URLSearchParams(location.search).get('appointmentId');
    if (appointmentId && !loading) document.getElementById(`appointment-${appointmentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentPage, location.search, loading]);

  const totalPages = Math.ceil(combinedHistory.length / pageSize) || 1;
  const paginatedHistory = combinedHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenPaymentModal = (item) => {
    setSelectedPaymentApp(item);
    setIsPaymentModalOpen(true);
  };

  const openCancellation = (item) => {
    const minutes = minutesUntilAppointment(item.appointment_date, item.time_slot);
    const hasPaidAmount = Number(item.invoice?.amount_paid || 0) > 0;
    const requiresReview = hasPaidAmount || minutes == null || minutes < 120;
    if (!requiresReview) {
      if (!window.confirm(`Hủy lịch khám #${item.id}? Lịch chưa thanh toán và còn ít nhất 2 giờ nên sẽ được hủy ngay.`)) return;
      axiosClient.post(`/appointments/${item.id}/cancellation-requests`, {})
        .then(() => fetchData())
        .catch((error) => window.alert(error.message || 'Không thể hủy lịch.'));
      return;
    }
    setCancellationModalItem(item);
    setCancellationReason('');
    setRefundAccountName('');
    setRefundBankName('');
    setRefundAccountNumber('');
    setCancellationError('');
  };

  const submitCancellationRequest = async () => {
    if (!cancellationModalItem) return;
    const item = cancellationModalItem;
    const minutes = minutesUntilAppointment(item.appointment_date, item.time_slot);
    const bankRefundRequired = (item.invoice?.payments || []).some((payment) => payment.payment_status === 'PAID' && payment.payment_method === 'BANK_TRANSFER');
    if (minutes != null && minutes < 120 && cancellationReason.trim().length < 3) {
      setCancellationError('Trong vòng 2 giờ trước giờ khám, vui lòng nhập lý do hủy.');
      return;
    }
    if (bankRefundRequired && (!refundAccountName.trim() || !refundBankName.trim() || !/^\d{6,24}$/.test(refundAccountNumber.replace(/\s+/g, '')))) {
      setCancellationError('Nhập tên chủ tài khoản, ngân hàng và số tài khoản nhận hoàn tiền hợp lệ.');
      return;
    }
    setCancellationSaving(true);
    setCancellationError('');
    try {
      await axiosClient.post(`/appointments/${item.id}/cancellation-requests`, {
        reason: cancellationReason,
        ...(bankRefundRequired ? { bankDetails: { accountName: refundAccountName, bankName: refundBankName, accountNumber: refundAccountNumber } } : {})
      });
      setCancellationModalItem(null);
      await fetchData();
    } catch (error) {
      setCancellationError(error.message || 'Không gửi được yêu cầu hủy lịch.');
    } finally { setCancellationSaving(false); }
  };

  const saveRefundBankDetails = async () => {
    if (!/^\d{6,24}$/.test(refundAccountNumber.replace(/\s+/g, '')) || !refundAccountName.trim() || !refundBankName.trim()) {
      setCancellationError('Nhập tên chủ tài khoản, ngân hàng và số tài khoản hợp lệ.');
      return;
    }
    setCancellationSaving(true);
    setCancellationError('');
    try {
      await axiosClient.put(`/appointments/cancellation-requests/${bankDetailsRequestId}/bank-details`, { accountName: refundAccountName, bankName: refundBankName, accountNumber: refundAccountNumber });
      setBankDetailsRequestId(null);
      await fetchData();
    } catch (error) { setCancellationError(error.message || 'Không lưu được thông tin nhận hoàn.'); }
    finally { setCancellationSaving(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans">
      {/* Tiêu đề */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-500">Xin chào, <span className="font-bold text-slate-800">{user?.full_name || 'Bệnh nhân'}</span></h2>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight mt-1">Lịch sử khám bệnh & Hóa đơn viện phí</h1>
          <p className="text-xs text-slate-400 mt-1">Tra cứu thông tin các buổi khám, kết quả lâm sàng và thực hiện thanh toán VietQR / Tiền mặt.</p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Bảng Lịch sử khám bệnh */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="py-4 px-6">Mã Lịch</th>
                <th className="py-4 px-6">Ngày & Giờ khám</th>
                <th className="py-4 px-6">Bác sĩ khám</th>
                <th className="py-4 px-6">Phòng khám</th>
                <th className="py-4 px-6">Trạng thái khám</th>
                <th className="py-4 px-6">Thanh toán</th>
                <th className="py-4 px-6 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải lịch sử khám bệnh...</td>
                </tr>
              ) : paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Chưa có lịch khám nào trong lịch sử.</td>
                </tr>
              ) : (
                paginatedHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600"><span id={`appointment-${item.appointment_id || item.id}`} /><span id={item.invoice?.id ? `invoice-${item.invoice.id}` : undefined} />#{item.id}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800">{item.appointment_date}</div>
                      <div className="text-slate-400 text-[11px]">{item.time_slot}</div>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-800">{item.doctor_name}</td>
                    <td className="py-4 px-6 text-slate-600">{item.room_name || item.room_number || 'Chưa phân công'}</td>
                    <td className="py-4 px-6">
                      <StatusBadge status={item.status} type="appointment" />
                    </td>
                    <td className="py-4 px-6">
                      {item.invoice ? <div className="space-y-1.5">
                        <div className="text-[11px] text-slate-700">Tổng {Number(item.invoice.total_amount).toLocaleString('vi-VN')}đ · Đã trả {Number(item.invoice.amount_paid).toLocaleString('vi-VN')}đ</div>
                        <div className={`text-[11px] font-semibold ${Number(item.invoice.amount_due) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{item.invoice.invoice_status === 'VOID' ? `Còn thiếu tại thời điểm hủy ${Number(item.invoice.amount_due).toLocaleString('vi-VN')}đ` : `Còn thiếu ${Number(item.invoice.amount_due).toLocaleString('vi-VN')}đ`}</div>
                        {item.invoice.invoice_status === 'VOID' && <span className="block text-[11px] font-semibold text-slate-600">Hóa đơn đã hết hiệu lực</span>}
                        {Number(item.invoice.amount_due) > 0 && item.status !== 'CANCELLED' && item.status !== 'NO_SHOW' && item.invoice.invoice_status !== 'VOID' && <button onClick={() => handleOpenPaymentModal(item)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1 text-xs font-bold text-white"><QrCode className="h-3.5 w-3.5" />Trả phần còn thiếu</button>}
                        {item.invoice.cash_requested_at && Number(item.invoice.amount_due) > 0 && <span className="block text-[11px] font-semibold text-amber-700">Tiền mặt tại quầy · đang chờ xác nhận thu</span>}
                        {item.status === 'CANCELLED' && <span className="text-[11px] font-semibold text-amber-700">Lịch đã hủy · khoản thu gốc vẫn được lưu</span>}
                        {item.cancellation && <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
                          <strong>{cancellationStatusText(item.cancellation)}</strong>
                          {(item.cancellation.patient_reason || item.cancellation.clinic_reason) && <p className="mt-1">Lý do: {item.cancellation.patient_reason || item.cancellation.clinic_reason}</p>}
                          {item.cancellation.status === 'REJECTED' && item.cancellation.decision_note && <p className="mt-1 text-rose-700">Lý do từ chối: {item.cancellation.decision_note}</p>}
                          {item.cancellation.bank_account_masked && <p className="mt-1">Tài khoản nhận hoàn: {item.cancellation.bank_account_masked}</p>}
                          {item.cancellation.status === 'APPROVED' && !item.cancellation.has_bank_details && item.cancellation.refunds?.some((refund) => refund.refund_method === 'BANK_TRANSFER' && refund.status === 'PENDING') && <button type="button" onClick={() => { setBankDetailsRequestId(item.cancellation.id); setRefundAccountName(''); setRefundBankName(''); setRefundAccountNumber(''); setCancellationError(''); }} className="mt-2 rounded-lg border border-teal-300 bg-white px-2.5 py-1.5 font-semibold text-teal-800">Cung cấp tài khoản nhận hoàn</button>}
                          {item.cancellation.refunds?.map((refund) => <p key={refund.id} className="mt-1">{refund.refund_method === 'CASH_COUNTER' ? 'Trả tại quầy' : 'Chuyển khoản'} · {Number(refund.amount).toLocaleString('vi-VN')} ₫ · {refund.status === 'COMPLETED' ? 'Đã hoàn' : 'Chờ hoàn'}{refund.reference_code ? ` · Mã ${refund.reference_code}` : ''}</p>)}
                        </div>}
                        <details className="text-[11px]"><summary className="cursor-pointer text-sky-700">Giao dịch ({item.invoice.payments?.length || 0})</summary><div className="mt-1 space-y-1">{item.invoice.payments?.map((payment) => <p key={payment.payment_id} className="text-slate-600">{payment.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · {Number(payment.amount).toLocaleString('vi-VN')}đ · {payment.transaction_code || payment.provider} · {new Date(payment.created_at).toLocaleString('vi-VN')}</p>)}</div></details>
                      </div> : <span className="text-xs text-slate-500">Hóa đơn đang được cập nhật.</span>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {['PENDING', 'CONFIRMED'].includes(item.status) && item.cancellation?.status !== 'PENDING' && (
                          <button onClick={() => openCancellation(item)} title="Yêu cầu hủy lịch" className="rounded-xl bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"><X className="h-4 w-4" /></button>
                        )}
                        <button
                          onClick={() => setSelectedRecord(item)}
                          title="Xem chi tiết buổi khám"
                          className="p-2 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-xl transition shadow-sm"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {cancellationModalItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
          <button type="button" aria-label="Đóng" className="fixed inset-0 bg-slate-950/50" onClick={() => setCancellationModalItem(null)} />
          <section className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-lg font-bold text-slate-900">Yêu cầu hủy lịch #{cancellationModalItem.id}</h3><p className="mt-1 text-sm text-slate-600">Lịch vẫn được giữ đến khi Admin duyệt. Duyệt yêu cầu chưa có nghĩa là tiền đã hoàn.</p></div>
              <button type="button" onClick={() => setCancellationModalItem(null)} aria-label="Đóng" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {Number(cancellationModalItem.invoice?.amount_paid || 0) > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Đã thu {Number(cancellationModalItem.invoice.amount_paid).toLocaleString('vi-VN')} ₫. Nếu được duyệt, việc hoàn tiền sẽ do phòng khám thực hiện thủ công.</p>}
            <label className="mt-4 block text-sm font-semibold text-slate-700">Lý do {minutesUntilAppointment(cancellationModalItem.appointment_date, cancellationModalItem.time_slot) < 120 ? '(bắt buộc)' : '(không bắt buộc)'}</label>
            <textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-600 focus:outline-none" placeholder="Nhập lý do hủy lịch" />
            {(cancellationModalItem.invoice?.payments || []).some((payment) => payment.payment_status === 'PAID' && payment.payment_method === 'BANK_TRANSFER') && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3">
              <h4 className="text-sm font-semibold text-slate-800">Thông tin nhận hoàn chuyển khoản</h4>
              <p className="text-xs text-slate-500">Chỉ Admin được xem đầy đủ; lịch sử của bạn chỉ hiện bốn số cuối tài khoản.</p>
              <input value={refundAccountName} onChange={(event) => setRefundAccountName(event.target.value)} maxLength={120} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Tên chủ tài khoản" />
              <input value={refundBankName} onChange={(event) => setRefundBankName(event.target.value)} maxLength={120} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Ngân hàng" />
              <input value={refundAccountNumber} onChange={(event) => setRefundAccountNumber(event.target.value)} maxLength={30} inputMode="numeric" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Số tài khoản" />
            </div>}
            {(cancellationModalItem.invoice?.payments || []).some((payment) => payment.payment_status === 'PAID' && payment.payment_method === 'CASH') && <p className="mt-3 text-sm text-slate-600">Khoản tiền mặt (nếu được duyệt hoàn) sẽ được trả tại quầy.</p>}
            {cancellationError && <p role="alert" className="mt-3 text-sm text-rose-700">{cancellationError}</p>}
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <button type="button" onClick={() => setCancellationModalItem(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Đóng</button>
              <button type="button" disabled={cancellationSaving} onClick={submitCancellationRequest} className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{cancellationSaving ? 'Đang gửi…' : 'Gửi yêu cầu hủy'}</button>
            </div>
          </section>
        </div>
      )}

      {bankDetailsRequestId && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
        <button type="button" aria-label="Đóng" className="fixed inset-0 bg-slate-950/50" onClick={() => setBankDetailsRequestId(null)} />
        <section className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900">Thông tin nhận hoàn chuyển khoản</h3>
          <p className="mt-1 text-sm text-slate-600">Chỉ Admin được xem đầy đủ thông tin tài khoản.</p>
          <div className="mt-4 space-y-3"><input value={refundAccountName} onChange={(event) => setRefundAccountName(event.target.value)} maxLength={120} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Tên chủ tài khoản" /><input value={refundBankName} onChange={(event) => setRefundBankName(event.target.value)} maxLength={120} className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Ngân hàng" /><input value={refundAccountNumber} onChange={(event) => setRefundAccountNumber(event.target.value)} maxLength={30} inputMode="numeric" className="w-full rounded-lg border border-slate-300 p-2.5 text-sm" placeholder="Số tài khoản" /></div>
          {cancellationError && <p role="alert" className="mt-3 text-sm text-rose-700">{cancellationError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setBankDetailsRequestId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Đóng</button><button type="button" disabled={cancellationSaving} onClick={saveRefundBankDetails} className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Lưu thông tin</button></div>
        </section>
      </div>}

      {/* Modal Chi Tiết Buổi Khám */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative min-w-0 bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-8 shadow-2xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800">
                  Chi tiết buổi khám #{selectedRecord.id}
                </h3>
                <span className="text-xs text-slate-400">Ngày khám: {selectedRecord.appointment_date}</span>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <section className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-sm">
              <h4 className="font-bold text-slate-900">Bệnh án và đơn thuốc</h4>
              {selectedRecord.medicalRecord ? <>
                <p><strong>Chẩn đoán:</strong> {selectedRecord.medicalRecord.final_diagnosis || 'Chưa ghi nhận'}</p>
                <p><strong>Triệu chứng:</strong> {selectedRecord.medicalRecord.symptoms || 'Chưa ghi nhận'}</p>
                <p><strong>Chẩn đoán ban đầu:</strong> {selectedRecord.medicalRecord.initial_diagnosis || 'Chưa ghi nhận'}</p>
                <p><strong>Sinh hiệu:</strong> {[
                  selectedRecord.medicalRecord.height != null && `Cao ${selectedRecord.medicalRecord.height} cm`,
                  selectedRecord.medicalRecord.weight != null && `Nặng ${selectedRecord.medicalRecord.weight} kg`,
                  selectedRecord.medicalRecord.blood_pressure && `HA ${selectedRecord.medicalRecord.blood_pressure} mmHg`,
                  selectedRecord.medicalRecord.temperature != null && `Nhiệt ${selectedRecord.medicalRecord.temperature} °C`,
                  selectedRecord.medicalRecord.heart_rate != null && `Mạch ${selectedRecord.medicalRecord.heart_rate}/phút`,
                  selectedRecord.medicalRecord.spo2 != null && `SpO₂ ${selectedRecord.medicalRecord.spo2}%`
                ].filter(Boolean).join(' · ') || 'Chưa ghi nhận'}</p>
                <p><strong>Mã ICD-10:</strong> {selectedRecord.medicalRecord.icd10_code ? `${selectedRecord.medicalRecord.icd10_code}${selectedRecord.medicalRecord.icd10_description ? ` · ${selectedRecord.medicalRecord.icd10_description}` : ''}` : 'Chưa ghi nhận'}</p>
                <p><strong>Kế hoạch điều trị:</strong> {selectedRecord.medicalRecord.treatment_plan || 'Chưa ghi nhận'}</p>
                <p><strong>Lời dặn:</strong> {selectedRecord.medicalRecord.advice || 'Chưa ghi nhận'}</p>
                <p><strong>Tái khám:</strong> {selectedRecord.medicalRecord.follow_up_date ? `${selectedRecord.medicalRecord.follow_up_date}${selectedRecord.medicalRecord.follow_up_notes ? ` · ${selectedRecord.medicalRecord.follow_up_notes}` : ''}` : 'Không hẹn tái khám'}</p>
                <div><strong>Đơn thuốc</strong>{selectedRecord.medicalRecord.prescriptions?.length ? <div className="mt-2 space-y-2">{selectedRecord.medicalRecord.prescriptions.map((drug) => <div key={drug.prescription_id} className="rounded-xl border bg-white p-3"><p className="font-semibold">{drug.medicine_name}{drug.medicine_generic_name ? ` (${drug.medicine_generic_name})` : ''}</p><p className="text-xs font-medium text-slate-600">{drug.dispensing_source === 'EXTERNAL' ? 'Bệnh nhân tự mua ngoài · không tính tiền thuốc phòng khám' : drug.dispensing_source === 'CLINIC' ? 'Phòng khám cấp' : 'Nguồn cấp chưa ghi nhận (đơn cũ)'}</p><p className="text-xs text-slate-600">Số lượng: {drug.quantity} {drug.unit_name || ''} · {drug.dosage} · {drug.duration} ngày</p><p className="text-xs text-slate-600">Quan hệ bữa ăn: {drug.meal_name || 'Không chỉ định'} · {drug.instructions || 'Không có hướng dẫn thêm'}</p></div>)}</div> : <p className="mt-1 text-slate-500">Không có thuốc được kê.</p>}</div>
              </> : <p className="text-slate-500">Chưa có bệnh án được lưu cho lần khám này.</p>}
            </section>

            {selectedRecord.invoice && <section className="patient-invoice-receipt rounded-2xl border border-slate-200 p-4 text-sm">
              <div className="flex items-center justify-between"><h4 className="font-bold">Biên lai / hóa đơn #{selectedRecord.invoice.id}</h4><button type="button" className="patient-receipt-action inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold" onClick={() => window.print()}><Download className="h-3.5 w-3.5" />In biên lai</button></div>
              <p className="mt-2">Bệnh nhân: {user?.full_name || 'Bệnh nhân'} · Phương thức: {selectedRecord.invoice.payment_method === 'CASH' ? 'Tiền mặt' : 'QR / chuyển khoản'}</p>
              <div className="mt-2 divide-y">{selectedRecord.invoice.items?.map((line) => <div key={line.id} className="flex justify-between gap-3 py-2"><span>{line.description} · {line.quantity} × {Number(line.unit_price).toLocaleString('vi-VN')}đ</span><strong>{Number(line.line_total).toLocaleString('vi-VN')}đ</strong></div>)}</div>
              <p className="mt-2">Phí dịch vụ {Number(selectedRecord.invoice.service_fee).toLocaleString('vi-VN')}đ · Thuốc {Number(selectedRecord.invoice.medicine_fee).toLocaleString('vi-VN')}đ</p>
              <p className="mt-1 font-bold">Tổng {Number(selectedRecord.invoice.total_amount).toLocaleString('vi-VN')}đ · Đã thu {Number(selectedRecord.invoice.amount_paid).toLocaleString('vi-VN')}đ · Còn thiếu {Number(selectedRecord.invoice.amount_due).toLocaleString('vi-VN')}đ</p>
              <div className="mt-2 border-t pt-2"><strong>Giao dịch đã ghi nhận</strong>{selectedRecord.invoice.payments?.length ? selectedRecord.invoice.payments.map((payment) => <p key={payment.payment_id} className="mt-1 text-xs">{payment.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · {Number(payment.amount).toLocaleString('vi-VN')}đ · {payment.transaction_code || payment.provider} · {new Date(payment.created_at).toLocaleString('vi-VN')}</p>) : <p className="mt-1 text-xs text-slate-500">Chưa ghi nhận khoản thu.</p>}</div>
            </section>}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-slate-400 block">Bác sĩ phụ trách:</span>
                  <strong className="text-slate-800">{selectedRecord.doctor_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Phòng khám:</span>
                  <strong className="text-slate-800">{selectedRecord.room_name} ({selectedRecord.room_number})</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Trạng thái khám:</span>
                  <StatusBadge status={selectedRecord.status} type="appointment" />
                </div>
                <div>
                  <span className="text-slate-400 block">Trạng thái thanh toán:</span>
                  <strong className={selectedRecord.isPaid ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {selectedRecord.invoice ? `${Number(selectedRecord.invoice.amount_paid).toLocaleString('vi-VN')}đ đã thu · ${Number(selectedRecord.invoice.amount_due).toLocaleString('vi-VN')}đ còn thiếu` : 'Chưa có hóa đơn'}
                  </strong>
                  {selectedRecord.invoice && <span className="mt-1 block text-slate-600">Phương thức: {selectedRecord.invoice.payment_method === 'CASH' ? 'Tiền mặt' : 'QR / chuyển khoản'}{selectedRecord.invoice.cash_requested_at && !selectedRecord.isPaid ? ' · đang chờ thu tại quầy' : ''}</span>}
                </div>
              </div>
            </div>

            {!selectedRecord.isPaid && selectedRecord.status !== 'CANCELLED' && selectedRecord.status !== 'NO_SHOW' && selectedRecord.invoice?.invoice_status !== 'VOID' && Number(selectedRecord.invoice?.amount_due) > 0 && (
              <button
                onClick={() => {
                  const rec = selectedRecord;
                  setSelectedRecord(null);
                  handleOpenPaymentModal(rec);
                }}
                className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-sky-600/30 flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Thanh toán phần còn thiếu bằng QR</span>
              </button>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal VietQR SePay */}
      {selectedPaymentApp && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          appointmentId={selectedPaymentApp.id}
          patientName={user?.full_name || 'Bệnh nhân'}
          amount={selectedPaymentApp.invoice?.total_amount}
          initialPaymentMethod={selectedPaymentApp.invoice?.payment_method}
          onSuccess={() => fetchData()}
        />
      )}
      <style>{`@media print { body * { visibility: hidden !important; } .patient-invoice-receipt, .patient-invoice-receipt * { visibility: visible !important; } .patient-invoice-receipt { position: fixed !important; inset: 0 !important; border: 0 !important; border-radius: 0 !important; padding: 24px !important; background: white !important; } .patient-receipt-action { display: none !important; } }`}</style>
    </div>
  );
};

export default MedicalHistory;

import React, { useEffect, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { socket } from '../../api/socket';
import { useAuth } from '../../context/AuthContext';
import { QrCode, Banknote, Copy, CheckCircle2, X, Loader2, Check, RefreshCw } from 'lucide-react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const PaymentModal = ({ isOpen, onClose, appointmentId, patientName, amount, onSuccess, onPaymentMethodSelected, lockedPaymentMethod = null, initialPaymentMethod = null, paymentPurpose = 'APPOINTMENT' }) => {
  const { user } = useAuth();
  const defaultMethod = lockedPaymentMethod || initialPaymentMethod;
  const isMedicinePayment = paymentPurpose === 'MEDICINE_BALANCE';
  const initialTab = isMedicinePayment && !defaultMethod ? 'SELECT' : defaultMethod === 'CASH' ? 'CASH' : 'QR';
  const [selectedMethod, setSelectedMethod] = useState(defaultMethod);
  const hasLockedMethod = selectedMethod === 'CASH' || selectedMethod === 'BANK_TRANSFER';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [copiedField, setCopiedField] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);
  const [summary, setSummary] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);
  const [initialStatusLoaded, setInitialStatusLoaded] = useState(!isMedicinePayment);
  const qrSequence = useRef(0);
  const qrDataRef = useRef(null);
  const reloadQrRef = useRef(null);
  const successHandled = useRef(false);
  const activeTabRef = useRef(initialTab);
  const notifiedMethodRef = useRef(defaultMethod);
  const onSuccessRef = useRef(onSuccess);
  const onPaymentMethodSelectedRef = useRef(onPaymentMethodSelected);
  const onCloseRef = useRef(onClose);
  onSuccessRef.current = onSuccess;
  onPaymentMethodSelectedRef.current = onPaymentMethodSelected;
  onCloseRef.current = onClose;

  const notifyPaymentMethod = (method) => {
    if (!isMedicinePayment || notifiedMethodRef.current === method) return;
    notifiedMethodRef.current = method;
    onPaymentMethodSelectedRef.current?.(method);
  };

  useEffect(() => {
    if (!isOpen || !appointmentId) return undefined;
    let active = true;
    qrSequence.current += 1;
    successHandled.current = false;
    let pollId;
    const persistedMethod = lockedPaymentMethod || initialPaymentMethod || null;
    notifiedMethodRef.current = persistedMethod;
    const startingTab = isMedicinePayment && !persistedMethod ? 'SELECT' : persistedMethod === 'CASH' ? 'CASH' : 'QR';
    activeTabRef.current = startingTab;
    setSelectedMethod(persistedMethod);
    setInitialStatusLoaded(!isMedicinePayment);
    setActiveTab(startingTab); setCopiedField(''); setIsSuccess(false); setSuccessInfo(null);
    setSummary(null); setQrData(null); qrDataRef.current = null; setQrError(''); setStatusError(''); setCashSubmitting(false);

    const loadQr = async () => {
      const request = ++qrSequence.current;
      setQrLoading(true); setQrError('');
      try {
        const result = await axiosClient.post('/payments/create-qr', { appointmentId, ...(isMedicinePayment ? { purpose: 'MEDICINE_BALANCE' } : {}) });
        if (!active || request !== qrSequence.current) return;
        if (isMedicinePayment) {
          setSelectedMethod('BANK_TRANSFER');
          notifyPaymentMethod('BANK_TRANSFER');
        }
        qrDataRef.current = result.data;
        setQrData(result.data);
      } catch (error) {
        if (active && request === qrSequence.current) {
          setQrData(null);
          qrDataRef.current = null;
          setQrError(error.message || 'Không tải được QR. Bạn vẫn có thể chọn tab tiền mặt.');
        }
      } finally {
        if (active && request === qrSequence.current) setQrLoading(false);
      }
    };
    reloadQrRef.current = loadQr;

    const checkStatus = async () => {
      if (!active || successHandled.current) return;
      try {
        const result = await axiosClient.get(`/payments/status/${appointmentId}`);
        if (!active) return;
        setSummary(result.invoice);
        if (isMedicinePayment && result.invoice?.medicine_payment_method) {
          setSelectedMethod(result.invoice.medicine_payment_method);
          const savedTab = result.invoice.medicine_payment_method === 'CASH' ? 'CASH' : 'QR';
          activeTabRef.current = savedTab;
          setActiveTab(savedTab);
          notifyPaymentMethod(result.invoice.medicine_payment_method);
        }
        setStatusError('');
        const due = Number(result.invoice?.outstanding_amount || 0);
        if (result.isPaid) {
          setIsSuccess(true);
          setSuccessInfo({ paymentMethod: result.invoice?.payment_method, paidAmount: result.invoice?.paid_amount, totalAmount: result.invoice?.total_amount });
          successHandled.current = true;
          if (pollId) window.clearInterval(pollId);
          socket.off('payment_updated', handlePaymentUpdated);
          onSuccessRef.current?.();
        } else if (activeTabRef.current === 'QR' && due > 0 && qrDataRef.current && Number(qrDataRef.current.amount) !== due) {
          if (qrDataRef.current) {
            qrDataRef.current = null;
            setQrData(null);
          }
          if (activeTabRef.current === 'QR' && (isMedicinePayment ? selectedMethod !== 'CASH' : lockedPaymentMethod !== 'CASH')) loadQr();
        }
      } catch (error) { if (active) setStatusError(error.message || 'Không kết nối được để xác minh thanh toán.'); }
      finally { if (active) setInitialStatusLoaded(true); }
    };

    const handlePaymentUpdated = (event) => {
      if (Number(event.appointmentId) === Number(appointmentId)) checkStatus();
    };
    socket.on('payment_updated', handlePaymentUpdated);
    pollId = window.setInterval(checkStatus, 5000);
    if (startingTab === 'QR' && lockedPaymentMethod !== 'CASH') loadQr();
    checkStatus();
    return () => {
      active = false;
      reloadQrRef.current = null;
      qrSequence.current += 1;
      socket.off('payment_updated', handlePaymentUpdated);
      if (pollId) window.clearInterval(pollId);
    };
  }, [isOpen, appointmentId, lockedPaymentMethod, initialPaymentMethod, paymentPurpose]);

  if (!isOpen) return null;

  const totalAmount = summary?.total_amount ?? qrData?.totalAmount ?? 0;
  const paidAmount = summary?.paid_amount ?? qrData?.paidAmount ?? 0;
  const dueAmount = summary?.outstanding_amount ?? qrData?.amount ?? (Number(totalAmount || 0) - Number(paidAmount || 0));
  const { bankName, accountNumber, accountName, transferContent, qrUrl } = qrData || {};

  const handleCopy = async (text, fieldName) => {
    try { await navigator.clipboard.writeText(String(text || '')); setCopiedField(fieldName); window.setTimeout(() => setCopiedField(''), 1800); }
    catch { setCopiedField(''); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => onCloseRef.current?.()} />
    <div className="relative z-10 max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-xl space-y-5 overflow-y-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-2xl sm:p-8">
      <header className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div><h3 className="text-lg font-black text-slate-800">{isMedicinePayment ? 'Thanh toán tiền thuốc' : 'Thanh toán viện phí'}</h3><p className="mt-1 text-xs text-slate-500">{patientName || 'Bệnh nhân'} · Mã lịch #{appointmentId}</p></div>
        <button type="button" aria-label="Đóng" onClick={() => onCloseRef.current?.()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
      </header>

      <section className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-xs min-[390px]:grid-cols-3">
        <div><div className="text-slate-500">Tổng hóa đơn</div><strong className="text-slate-900">{money(totalAmount)}</strong></div>
        <div><div className="text-slate-500">Đã thanh toán</div><strong className="text-emerald-700">{money(paidAmount)}</strong></div>
        <div><div className="text-slate-500">Còn thiếu</div><strong className="text-rose-700">{money(dueAmount)}</strong></div>
      </section>

      {isSuccess ? <div role="status" className="space-y-3 py-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h4 className="text-xl font-bold text-slate-900">Đã thanh toán đủ</h4>
        <p className="text-sm text-slate-600">Server đã xác nhận hóa đơn đã thu đủ. Đóng modal chỉ đóng thông báo.</p>
        <p className="font-semibold text-emerald-700">{money(successInfo?.paidAmount)} / {money(successInfo?.totalAmount)}</p>
        <button type="button" onClick={() => onCloseRef.current?.()} className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white">Đóng</button>
      </div> : <>
        {hasLockedMethod ? <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${selectedMethod === 'CASH' ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'}`}>{isMedicinePayment ? 'Phương thức tiền thuốc đã chọn: ' : 'Phương thức đã chọn: '}{selectedMethod === 'CASH' ? 'tiền mặt tại quầy · Admin xác nhận sau khi thực nhận' : 'QR / chuyển khoản · chờ webhook SePay xác nhận'}</p> : <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" disabled={!initialStatusLoaded} onClick={() => { activeTabRef.current = 'QR'; setActiveTab('QR'); if (!isMedicinePayment) reloadQrRef.current?.(); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50 ${activeTab === 'QR' ? 'border-sky-700 bg-sky-700 text-white shadow-sm' : 'border-sky-200 bg-white text-sky-800 hover:bg-sky-50'}`}><QrCode className="h-4 w-4" />Chuyển khoản QR</button>
          <button type="button" disabled={!initialStatusLoaded} onClick={() => { activeTabRef.current = 'CASH'; setActiveTab('CASH'); }} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-50 ${activeTab === 'CASH' ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm' : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'}`}><Banknote className="h-4 w-4" />Tiền mặt tại quầy</button>
        </div>}

        {activeTab === 'SELECT' && <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900"><p className="font-semibold">Chọn cách thanh toán tiền thuốc</p><p className="mt-1">Bạn có thể đổi lựa chọn bằng hai nút phương thức phía trên trước khi tạo QR hoặc gửi yêu cầu tiền mặt.</p></div>}
        {activeTab === 'QR' && <div className="space-y-4">
          {qrLoading && !qrData && <div role="status" className="flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Đang tải thông tin thanh toán…</div>}
          {qrError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{qrError}</div>}
          {isMedicinePayment && !hasLockedMethod && !qrData && !qrLoading && !qrError && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm text-sky-900">Tạo mã QR cho đúng số tiền thuốc còn thiếu. Phương thức được ghi nhận khi mã QR được tạo. Bạn có thể chọn cách khác ở thanh phương thức phía trên trước bước này.</p><button type="button" onClick={() => reloadQrRef.current?.()} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"><QrCode className="h-4 w-4" />Tạo mã QR thanh toán</button></div>}
          {qrData && <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center gap-2">{qrUrl ? <img src={qrUrl} alt="QR chuyển khoản" className="h-44 w-44 rounded-lg border bg-white object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : <div className="flex h-44 w-44 items-center justify-center rounded-lg bg-white text-sm text-slate-500">Không có QR</div>}<span className="text-xs text-slate-500">Số tiền QR: {money(qrData.amount)} · lấy từ máy chủ</span></div>
            <div className="min-w-0 space-y-2 text-sm"><p className="break-words"><span className="text-slate-500">Ngân hàng:</span> <strong>{bankName}</strong></p><p className="break-words"><span className="text-slate-500">Số tài khoản:</span> <strong>{accountNumber}</strong></p><p className="break-words"><span className="text-slate-500">Chủ tài khoản:</span> <strong>{accountName}</strong></p><div className="flex min-w-0 flex-wrap items-start gap-2 rounded-lg bg-white p-2"><span className="shrink-0 text-slate-500">Nội dung:</span><strong className="min-w-0 flex-1 break-all font-mono">{transferContent}</strong><button type="button" className="min-h-8 min-w-8 shrink-0 rounded-md" aria-label="Sao chép nội dung" onClick={() => handleCopy(transferContent, 'content')}>{copiedField === 'content' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</button></div></div>
          </div>}
          <p className="flex items-center gap-2 rounded-lg bg-sky-50 p-3 text-xs text-sky-800"><Loader2 className="h-4 w-4 animate-spin" />Trạng thái được xác minh từ máy chủ, qua socket hoặc kiểm tra định kỳ.</p>
          {statusError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{statusError} Nếu bạn đã chuyển tiền, không chuyển lại; giữ biên nhận và liên hệ phòng khám để đối soát.</div>}
          <div className="flex flex-wrap gap-2"><button type="button" disabled={qrLoading || Number(dueAmount) <= 0} onClick={() => reloadQrRef.current?.()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="mr-1 inline h-4 w-4" />Tải QR lại</button><button type="button" onClick={() => { setStatusError(''); axiosClient.get(`/payments/status/${appointmentId}`).then((result) => { setSummary(result.invoice); if (result.isPaid) { setIsSuccess(true); setSuccessInfo({ paymentMethod: result.invoice?.payment_method, paidAmount: result.invoice?.paid_amount, totalAmount: result.invoice?.total_amount }); if (!successHandled.current) { successHandled.current = true; if (pollId) window.clearInterval(pollId); socket.off('payment_updated', handlePaymentUpdated); onSuccessRef.current?.(); } } }).catch((error) => setStatusError(error.message || 'Không kiểm tra được trạng thái thanh toán.')); }} className="rounded-lg border px-3 py-2 text-sm"><RefreshCw className="mr-1 inline h-4 w-4" />Kiểm tra thanh toán</button></div>
        </div>}

        {activeTab === 'CASH' && <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <Banknote className="mx-auto h-10 w-10 text-emerald-700" />
          <h4 className="font-bold text-emerald-950">Thanh toán tiền mặt tại quầy</h4>
          <p className="text-sm text-emerald-900">Số còn phải thu {isMedicinePayment ? 'cho tiền thuốc' : 'theo hóa đơn'}: <strong>{money(dueAmount)}</strong>.</p>
          {isMedicinePayment && !hasLockedMethod && <p className="text-xs text-emerald-800">Bạn có thể chọn cách khác ở thanh phương thức phía trên trước khi gửi yêu cầu. Yêu cầu tiền mặt chỉ chờ Admin xác nhận, chưa ghi nhận đã thu.</p>}
          <p className="text-xs text-emerald-800">Đóng cửa sổ này không xác nhận đã trả tiền. Nhân viên admin chỉ ghi nhận sau khi thực nhận tiền mặt tại quầy.</p>
          {summary?.cash_requested_at ? <p role="status" className="rounded-lg bg-white p-3 text-sm font-semibold text-emerald-800">Đã gửi yêu cầu · đang chờ xác nhận tại quầy.</p> : user?.role === 'PATIENT' ? <button type="button" disabled={cashSubmitting || Number(dueAmount) <= 0 || !(summary?.id || qrData?.invoiceId)} onClick={async () => { setCashSubmitting(true); try { await axiosClient.post(`/invoices/${summary?.id || qrData?.invoiceId}/cash-request`, isMedicinePayment ? { purpose: 'MEDICINE_BALANCE' } : {}); setSelectedMethod('CASH'); notifyPaymentMethod('CASH'); setStatusError(''); const status = await axiosClient.get(`/payments/status/${appointmentId}`); setSummary(status.invoice); } catch (error) { setStatusError(error.message || 'Không gửi được yêu cầu tiền mặt.'); } finally { setCashSubmitting(false); } }} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{cashSubmitting ? 'Đang gửi…' : 'Chọn tiền mặt tại quầy'}</button> : <p className="rounded-lg bg-white p-3 text-sm text-emerald-800">Admin xác nhận khoản tiền mặt đã thực nhận tại trang quản lý hóa đơn.</p>}
          {statusError && <div role="alert" className="rounded-lg bg-white p-3 text-sm text-amber-900">{statusError}</div>}
          <button type="button" onClick={() => onCloseRef.current?.()} className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">Đóng</button>
        </div>}
      </>}
    </div>
  </div>;
};

export default PaymentModal;

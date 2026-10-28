import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import PaymentModal from '../../components/common/PaymentModal';
import { socket } from '../../api/socket';
import { RefreshCw, QrCode, Banknote, Printer, Search } from 'lucide-react';

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 })} ₫` : '—';
};

const formatAppointmentDate = (value) => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '—';
  const [, year, month, day] = match;
  return `${day}/${month}/${year} 00:00`;
};

const formatVietnamDateTime = (value) => {
  if (!value) return '—';
  const raw = String(value);
  // A SQL DATETIME has no timezone; preserve its stored wall-clock time.
  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/);
  if (localMatch && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const [, year, month, day, hour, minute] = localMatch;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
};

const getAmountDue = (invoice) => Number(invoice.amount_due ?? (invoice.payment_status === 'PAID' ? 0 : invoice.total_amount));
const getPaymentState = (invoice) => {
  const paid = Number(invoice.amount_paid || 0);
  const due = getAmountDue(invoice);
  if (invoice.payment_status === 'PAID' || (Number(invoice.total_amount) > 0 && due <= 0)) {
    return { label: 'Đã thanh toán', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  }
  if (paid > 0) return { label: 'Thanh toán một phần', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  return { label: 'Chưa thanh toán', className: 'border-rose-200 bg-rose-50 text-rose-800' };
};

const getPaymentMethod = (method) => {
  if (method === 'CASH') return 'Tiền mặt';
  if (method === 'BANK_TRANSFER') return 'QR / chuyển khoản';
  return method || 'Chưa chọn';
};

const InvoiceMgmt = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // State cho Modal thanh toán
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cashProcessing, setCashProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptInvoice, setReceiptInvoice] = useState(null);

  useEffect(() => {
    fetchInvoices();

    // Lắng nghe sự kiện thanh toán thành công để tự động refresh danh sách
    const handlePaymentCompleted = (data) => {
      console.log('⚡ Socket event payment_updated received in InvoiceMgmt:', data);
      fetchInvoices();
    };

    socket.on('payment_updated', handlePaymentCompleted);
    return () => {
      socket.off('payment_updated', handlePaymentCompleted);
    };
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/invoices');
      if (res.success) {
        setInvoices(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách hóa đơn:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const query = searchTerm.trim().toLocaleLowerCase('vi');
    if (!query) return true;
    return [invoice.id, invoice.appointment_id, invoice.patient_name, invoice.patient_phone]
      .some((value) => String(value || '').toLocaleLowerCase('vi').includes(query));
  });

  const confirmCash = async (invoice) => {
    const due = Number(invoice.amount_due ?? invoice.total_amount);
    if (due <= 0 || !window.confirm(`Bệnh nhân: ${invoice.patient_name}\nHóa đơn: #INV-${invoice.id}\nSố còn thiếu hiện tại: ${formatMoney(due)}\n\nXác nhận khoản tiền này đã được thực nhận tại quầy?`)) return;
    setCashProcessing(invoice.id);
    try {
      await axiosClient.patch(`/invoices/${invoice.id}/pay`, { expectedAmount: due });
      await fetchInvoices();
    } catch (error) {
      window.alert(error.message || 'Không xác nhận được khoản thu. Hãy kiểm tra lại hóa đơn.');
      if (error.code === 'AMOUNT_CHANGED' || error.data?.latestAmountDue !== undefined) await fetchInvoices();
    }
    finally { setCashProcessing(null); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Quản lý hóa đơn</h2>
          <p className="text-sm text-slate-500 mt-1">Theo dõi số tiền đã thu, số còn thiếu và ghi nhận thanh toán tại quầy.</p>
        </div>

        <button
          onClick={fetchInvoices}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm mã hóa đơn, mã lịch, tên hoặc điện thoại" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" /></div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                <th className="w-[22%] px-4 py-3.5">Hóa đơn · Bệnh nhân · Ngày khám</th>
                <th className="w-[18%] px-4 py-3.5">Chi phí</th>
                <th className="w-[18%] px-4 py-3.5">Thanh toán</th>
                <th className="w-[17%] px-4 py-3.5">Trạng thái · Phương thức</th>
                <th className="w-[25%] px-4 py-3.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Đang tải danh sách hóa đơn…</td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">{invoices.length ? 'Không tìm thấy hóa đơn phù hợp.' : 'Chưa có hóa đơn nào được tạo.'}</td></tr>
              ) : filteredInvoices.map((inv) => {
                const due = getAmountDue(inv);
                const paid = Number(inv.amount_paid || 0);
                const medicineFee = Number(inv.medicine_fee || 0);
                const medicineLines = (inv.items || []).filter((line) => line.item_type === 'MEDICINE');
                const paymentState = getPaymentState(inv);
                return <tr key={inv.id} className="align-top transition-colors hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <p className="whitespace-nowrap font-semibold text-teal-800">#INV-{inv.id}</p>
                    <p className="mt-1 max-w-56 break-words font-semibold text-slate-800">{inv.patient_name || 'Chưa cập nhật'}</p>
                    {inv.patient_phone && <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">{inv.patient_phone}</p>}
                    <p className="mt-2 whitespace-nowrap text-xs tabular-nums text-slate-600">Khám: {formatAppointmentDate(inv.appointment_date)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <dl className="space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Tiền khám</dt><dd className="whitespace-nowrap font-medium text-slate-800">{formatMoney(inv.service_fee)}</dd></div>
                      <div className="flex items-center justify-between gap-3"><dt className="text-slate-500">Tiền thuốc</dt><dd className="whitespace-nowrap font-medium text-slate-800">{formatMoney(medicineFee)}</dd></div>
                    </dl>
                    {medicineFee > 0 && medicineLines.length > 0 && <details className="mt-2 text-xs">
                      <summary className="w-fit cursor-pointer font-medium text-teal-800 hover:text-teal-900">Chi tiết thuốc ({medicineLines.length})</summary>
                      <div className="mt-2 max-w-64 space-y-2 rounded-lg bg-slate-50 p-2.5">
                        {medicineLines.map((line) => <div key={line.id} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <p className="break-words font-medium text-slate-800">{line.description}</p>
                          <p className="mt-0.5 text-slate-600">{Number(line.quantity).toLocaleString('vi-VN')} × {formatMoney(line.unit_price)} = <span className="font-semibold text-slate-800">{formatMoney(line.line_total)}</span></p>
                        </div>)}
                      </div>
                    </details>}
                  </td>
                  <td className="px-4 py-4">
                    <p className="whitespace-nowrap text-base font-semibold tabular-nums text-slate-900">{formatMoney(inv.total_amount)}</p>
                    <p className="mt-2 whitespace-nowrap text-xs tabular-nums text-slate-600">Đã thu <span className="font-medium text-slate-800">{formatMoney(paid)}</span></p>
                    <p className="mt-1 whitespace-nowrap text-xs tabular-nums text-slate-600">Còn thiếu <span className="font-medium text-slate-800">{formatMoney(due)}</span></p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${paymentState.className}`}>{paymentState.label}</span>
                    <p className="mt-2 whitespace-nowrap text-xs text-slate-600">{getPaymentMethod(inv.payment_method)}</p>
                    {inv.cash_requested_at && inv.payment_status !== 'PAID' && <p className="mt-1 max-w-44 text-xs leading-5 text-amber-800">Đang chờ thu tiền mặt tại quầy</p>}
                    {/(REVIEW|OVERPAID)/.test(inv.reconciliation_statuses || '') && <p className="mt-1 max-w-44 text-xs leading-5 font-medium text-amber-800">Cần đối soát: {inv.reconciliation_statuses}</p>}
                    {(inv.payments?.length || 0) > 0 && <details className="mt-2 text-xs">
                      <summary className="w-fit cursor-pointer font-medium text-teal-800">Giao dịch ({inv.payments.length})</summary>
                      <div className="mt-2 max-w-64 space-y-2 rounded-lg bg-slate-50 p-2.5">
                        {inv.payments.map((payment) => <div key={payment.payment_id} className="border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                          <p className="break-words font-medium text-slate-700">{getPaymentMethod(payment.payment_method)} · {formatMoney(payment.amount)}</p>
                          <p className="mt-0.5 break-all text-slate-500">{payment.transaction_code || payment.provider || '—'}</p>
                          <p className="mt-0.5 text-slate-500">{formatVietnamDateTime(payment.created_at)}{payment.received_by_name ? ` · Thu ngân: ${payment.received_by_name}` : ''}</p>
                        </div>)}
                      </div>
                    </details>}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {inv.appointment_status !== 'CANCELLED' && due > 0 && <>
                        <button disabled={cashProcessing === inv.id} onClick={() => confirmCash(inv)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"><Banknote className="h-3.5 w-3.5" />{cashProcessing === inv.id ? 'Đang ghi nhận…' : 'Xác nhận tiền mặt'}</button>
                        <button onClick={() => handleOpenPaymentModal(inv)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-100"><QrCode className="h-3.5 w-3.5" />QR</button>
                      </>}
                      {inv.appointment_status === 'CANCELLED' && <span className="text-xs leading-5 text-amber-800">Lịch đã hủy · cần đối soát khoản thu</span>}
                      {(inv.payments?.length || 0) > 0 && <button onClick={() => setReceiptInvoice(inv)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"><Printer className="h-3.5 w-3.5" />Biên nhận</button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thanh Toán VietQR / Tiền mặt */}
      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          appointmentId={selectedInvoice.appointment_id}
          patientName={selectedInvoice.patient_name}
          amount={selectedInvoice.total_amount}
          onSuccess={() => fetchInvoices()}
        />
      )}

      {receiptInvoice && <div className="receipt-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
        <section className="receipt-paper w-full max-w-lg rounded-2xl bg-white p-7 shadow-xl">
          <div className="mb-5 flex items-start justify-between">
            <div><h3 className="text-xl font-black">Biên nhận thanh toán</h3><p className="text-sm text-slate-500">MediClinic · Hóa đơn #INV-{receiptInvoice.id}</p></div>
            <button className="receipt-close rounded-lg border px-3 py-1 text-sm" onClick={() => setReceiptInvoice(null)}>Đóng</button>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm"><dt>Bệnh nhân</dt><dd className="text-right font-semibold">{receiptInvoice.patient_name}</dd><dt>Điện thoại</dt><dd className="text-right">{receiptInvoice.patient_phone || '—'}</dd><dt>Phương thức</dt><dd className="text-right">{getPaymentMethod(receiptInvoice.payment_method)}</dd><dt>Tổng hóa đơn</dt><dd className="text-right">{formatMoney(receiptInvoice.total_amount)}</dd><dt>Đã thu</dt><dd className="text-right font-bold text-emerald-700">{formatMoney(receiptInvoice.amount_paid || 0)}</dd><dt>Còn thiếu</dt><dd className="text-right">{formatMoney(receiptInvoice.amount_due || 0)}</dd></dl>
          <h4 className="mt-4 font-bold">Dòng hóa đơn</h4><div className="mt-2 space-y-1">{receiptInvoice.items?.map(line => <div key={line.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{line.description} · {Number(line.quantity).toLocaleString('vi-VN')} × {formatMoney(line.unit_price)}</span><strong className="whitespace-nowrap">{formatMoney(line.line_total)}</strong></div>)}</div>
          <h4 className="mt-4 font-bold">Giao dịch đã ghi nhận</h4>
          <div className="mt-2 space-y-2">{receiptInvoice.payments?.map(payment => <div key={payment.payment_id} className="flex justify-between gap-3 border-b pb-2 text-sm"><span>{getPaymentMethod(payment.payment_method)} · {payment.transaction_code || payment.provider}<small className="block text-slate-500">{formatVietnamDateTime(payment.created_at)}{payment.received_by_name ? ` · Thu ngân: ${payment.received_by_name}` : ''}</small></span><strong className="whitespace-nowrap">{formatMoney(payment.amount)}</strong></div>)}</div>
          <button className="receipt-close mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}><Printer className="h-4 w-4" />In biên nhận</button>
        </section>
        <style>{`@media print { body * { visibility: hidden !important; } .receipt-paper, .receipt-paper * { visibility: visible !important; } .receipt-overlay { position: absolute !important; inset: 0 !important; background: white !important; padding: 0 !important; } .receipt-paper { max-width: none !important; box-shadow: none !important; } .receipt-close { display: none !important; } }`}</style>
      </div>}
    </div>
  );
};

export default InvoiceMgmt;

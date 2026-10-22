import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import PaymentModal from '../../components/common/PaymentModal';
import { socket } from '../../api/socket';
import { Check, RefreshCw, QrCode, Banknote, Printer, Search } from 'lucide-react';

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
    if (due <= 0 || !window.confirm(`Bệnh nhân: ${invoice.patient_name}\nHóa đơn: #INV-${invoice.id}\nSố còn thiếu hiện tại: ${due.toLocaleString('vi-VN')} ₫\n\nXác nhận khoản tiền này đã được thực nhận tại quầy?`)) return;
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
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Thu Ngân & Viện Phí</h2>
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

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Mã Hóa Đơn</th>
                <th className="py-4 px-6">Bệnh nhân</th>
                <th className="py-4 px-6">Ngày khám</th>
                <th className="py-4 px-6">Tiền khám</th>
                <th className="py-4 px-6">Tiền thuốc</th>
                <th className="py-4 px-6">Tổng tiền</th>
                <th className="py-4 px-6">Đã thu / Còn thiếu</th>
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6 text-center">Xác nhận thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate-400">Đang tải danh sách hóa đơn...</td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-slate-400">{invoices.length ? 'Không tìm thấy hóa đơn phù hợp.' : 'Chưa có hóa đơn nào được tạo.'}</td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600">#INV-{inv.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{inv.patient_name}</td>
                    <td className="py-4 px-6 text-xs text-slate-600">{inv.appointment_date}</td>
                    <td className="py-4 px-6 text-slate-700">{Number(inv.service_fee).toLocaleString()}đ</td>
                    <td className="py-4 px-6 text-slate-700">{Number(inv.medicine_fee).toLocaleString()}đ</td>
                    <td className="py-4 px-6 font-black text-emerald-600">
                      {Number(inv.total_amount).toLocaleString()}đ
                    </td>
                    <td className="py-4 px-6 text-xs"><div className="font-semibold text-emerald-700">Đã thu: {Number(inv.amount_paid || 0).toLocaleString()}đ</div><div className="text-rose-600">Còn thiếu: {Number(inv.amount_due ?? inv.total_amount).toLocaleString()}đ</div><details className="mt-1"><summary className="cursor-pointer text-sky-700">Giao dịch ({inv.payments?.length || 0})</summary><div className="mt-1 min-w-56 space-y-1">{inv.payments?.map((payment) => <div key={payment.payment_id} className="border-t pt-1 text-[11px] text-slate-600">{payment.payment_method === 'CASH' ? 'Tiền mặt' : payment.payment_method === 'BANK_TRANSFER' ? 'Chuyển khoản' : payment.payment_method} · {Number(payment.amount).toLocaleString()}đ · {payment.transaction_code || payment.provider}<br />{new Date(payment.created_at).toLocaleString('vi-VN')}{payment.received_by_name ? ` · Thu ngân: ${payment.received_by_name}` : ''}</div>)}</div></details></td>
                    <td className="py-4 px-6">
                      <StatusBadge status={inv.payment_status} type="payment" />
                      {/(REVIEW|OVERPAID)/.test(inv.reconciliation_statuses || '') && <div className="mt-1 text-[11px] font-semibold text-amber-700">Cần đối soát: {inv.reconciliation_statuses}</div>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {inv.appointment_status !== 'CANCELLED' && Number(inv.amount_due ?? (inv.payment_status === 'PAID' ? 0 : inv.total_amount)) > 0 ? (
                        <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:justify-center">
                          <button disabled={cashProcessing === inv.id} onClick={() => confirmCash(inv)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Banknote className="h-3.5 w-3.5" />{cashProcessing === inv.id ? 'Đang ghi nhận…' : 'Xác nhận đã thu tiền mặt'}</button>
                          <button onClick={() => handleOpenPaymentModal(inv)} className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"><QrCode className="h-3.5 w-3.5" />QR</button>
                        </div>
                      ) : inv.appointment_status === 'CANCELLED' ? <span className="text-xs font-semibold text-amber-700">Lịch đã hủy · đối soát khoản thu thủ công</span> : (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã thu đủ</span>
                        </span>
                      )}
                      {(inv.payments?.length || 0) > 0 && <button onClick={() => setReceiptInvoice(inv)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"><Printer className="h-3.5 w-3.5" />Biên nhận</button>}
                    </td>
                  </tr>
                ))
              )}
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
          <dl className="grid grid-cols-2 gap-3 border-y py-4 text-sm"><dt>Bệnh nhân</dt><dd className="text-right font-semibold">{receiptInvoice.patient_name}</dd><dt>Điện thoại</dt><dd className="text-right">{receiptInvoice.patient_phone || '—'}</dd><dt>Tổng hóa đơn</dt><dd className="text-right">{Number(receiptInvoice.total_amount).toLocaleString('vi-VN')} ₫</dd><dt>Đã thu</dt><dd className="text-right font-bold text-emerald-700">{Number(receiptInvoice.amount_paid || 0).toLocaleString('vi-VN')} ₫</dd><dt>Còn thiếu</dt><dd className="text-right">{Number(receiptInvoice.amount_due || 0).toLocaleString('vi-VN')} ₫</dd></dl>
          <h4 className="mt-4 font-bold">Giao dịch đã ghi nhận</h4>
          <div className="mt-2 space-y-2">{receiptInvoice.payments?.map(payment => <div key={payment.payment_id} className="flex justify-between border-b pb-2 text-sm"><span>{payment.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · {payment.transaction_code || payment.provider}<small className="block text-slate-500">{new Date(payment.created_at).toLocaleString('vi-VN')}{payment.received_by_name ? ` · Thu ngân: ${payment.received_by_name}` : ''}</small></span><strong>{Number(payment.amount).toLocaleString('vi-VN')} ₫</strong></div>)}</div>
          <button className="receipt-close mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" onClick={() => window.print()}><Printer className="h-4 w-4" />In biên nhận</button>
        </section>
        <style>{`@media print { body * { visibility: hidden !important; } .receipt-paper, .receipt-paper * { visibility: visible !important; } .receipt-overlay { position: absolute !important; inset: 0 !important; background: white !important; padding: 0 !important; } .receipt-paper { max-width: none !important; box-shadow: none !important; } .receipt-close { display: none !important; } }`}</style>
      </div>}
    </div>
  );
};

export default InvoiceMgmt;

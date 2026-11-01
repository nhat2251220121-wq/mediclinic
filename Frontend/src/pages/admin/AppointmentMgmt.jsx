import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import PaymentModal from '../../components/common/PaymentModal';
import { socket } from '../../api/socket';
import { Calendar, Search, Filter, RefreshCw, Check, X, QrCode } from 'lucide-react';

const minutesUntilAppointment = (appointmentDate, timeSlot) => {
  const date = String(appointmentDate || '').slice(0, 10);
  const match = String(timeSlot || '').match(/(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !match) return null;
  const [year, month, day] = date.split('-').map(Number);
  return (Date.UTC(year, month - 1, day, Number(match[1]) - 7, Number(match[2])) - Date.now()) / 60000;
};

const refundLabel = (status) => ({ NOT_REQUIRED: 'Không cần hoàn', PENDING: 'Chờ hoàn tiền', PARTIAL: 'Đã hoàn một phần', COMPLETED: 'Đã hoàn tiền' }[status] || status);

const AppointmentMgmt = () => {
  const [appointments, setAppointments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellationRequests, setCancellationRequests] = useState([]);
  const [cancellationFilter, setCancellationFilter] = useState('PENDING');
  const [cancellationLoading, setCancellationLoading] = useState(true);

  // State cho Modal thanh toán
  const [selectedApp, setSelectedApp] = useState(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  useEffect(() => {
    fetchAppointments();

    const handlePaymentCompleted = (data) => {
      console.log('⚡ Socket payment_updated in AppointmentMgmt:', data);
      if (['CANCELLED', 'NO_SHOW'].includes(data?.status)) setIsPaymentOpen(false);
      fetchAppointments();
    };

    socket.on('payment_updated', handlePaymentCompleted);
    socket.on('cancellation_requests_updated', handlePaymentCompleted);
    socket.on('appointments_updated', handlePaymentCompleted);
    return () => {
      socket.off('payment_updated', handlePaymentCompleted);
      socket.off('cancellation_requests_updated', handlePaymentCompleted);
      socket.off('appointments_updated', handlePaymentCompleted);
    };
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const [res, cancellationRes] = await Promise.all([
        axiosClient.get('/appointments'),
        axiosClient.get('/appointments/admin/cancellation-requests', { params: { status: cancellationFilter } })
      ]);
      if (res.success) {
        setAppointments(res.data);
      }
      if (cancellationRes.success) setCancellationRequests(cancellationRes.data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách lịch hẹn:', err);
    } finally {
      setLoading(false);
      setCancellationLoading(false);
    }
  };

  const handleClinicCancel = async (app) => {
    const reason = window.prompt('Nhập lý do phòng khám hủy lịch:') || '';
    if (reason.trim().length < 3) return window.alert('Cần nhập lý do hủy từ 3 ký tự trở lên.');
    if (!window.confirm(`Xác nhận hủy lịch #${app.id} từ phía phòng khám? Lý do: ${reason.trim()} Đã thu ${Number(app.amount_paid || 0).toLocaleString('vi-VN')} ₫; khoản này sẽ được giữ nguyên và tạo khoản hoàn thủ công toàn bộ.`)) return;
    try { await axiosClient.post(`/appointments/admin/${app.id}/cancel`, { reason }); await fetchAppointments(); }
    catch (error) { window.alert(error.message || 'Không thể hủy lịch.'); }
  };

  const handleNoShow = async (app) => {
    if (!window.confirm(`Xác nhận đã kiểm tra và bệnh nhân vắng lịch #${app.id}? Chỉ được ghi nhận sau ít nhất 15 phút từ giờ bắt đầu.`)) return;
    try { await axiosClient.post(`/appointments/admin/${app.id}/no-show`, { confirmedAbsent: true }); await fetchAppointments(); }
    catch (error) { window.alert(error.message || 'Không thể ghi nhận vắng mặt.'); }
  };

  const handleApproveCancellation = async (item) => {
    const paid = Number(item.paid_amount || 0);
    const needsAmount = paid > 0 && (item.request_source === 'CLINIC' || item.under_2_hours);
    let refundAmount;
    if (needsAmount) {
      const entered = window.prompt(`Số tiền hoàn được duyệt (tối đa ${Number(item.refundable_remaining).toLocaleString('vi-VN')} ₫):`, String(item.refundable_remaining));
      if (entered === null) return;
      refundAmount = Number(entered.replace(/,/g, ''));
      if (!Number.isFinite(refundAmount)) return window.alert('Số tiền hoàn không hợp lệ.');
    }
    if (!window.confirm(needsAmount ? `Duyệt hủy lịch và tạo khoản hoàn ${refundAmount.toLocaleString('vi-VN')} ₫ ở trạng thái chờ hoàn?` : 'Duyệt yêu cầu hủy lịch? Lịch sẽ bị hủy và hóa đơn hết hiệu lực.')) return;
    try { await axiosClient.post(`/appointments/admin/cancellation-requests/${item.id}/approve`, refundAmount === undefined ? {} : { refundAmount }); await fetchAppointments(); }
    catch (error) { window.alert(error.message || 'Không thể duyệt yêu cầu.'); }
  };

  const handleRejectCancellation = async (item) => {
    const reason = window.prompt(`Nhập lý do từ chối yêu cầu hủy lịch #${item.appointment_id}:`) || '';
    if (reason.trim().length < 3) return window.alert('Lý do từ chối phải có ít nhất 3 ký tự.');
    try { await axiosClient.post(`/appointments/admin/cancellation-requests/${item.id}/reject`, { reason }); await fetchAppointments(); }
    catch (error) { window.alert(error.message || 'Không thể từ chối yêu cầu.'); }
  };

  const handleConfirmRefund = async (request, refund) => {
    const body = {};
    if (refund.refund_method === 'BANK_TRANSFER') {
      const referenceCode = window.prompt(`Nhập mã tham chiếu chuyển khoản hoàn ${Number(refund.amount).toLocaleString('vi-VN')} ₫:`) || '';
      if (!referenceCode.trim()) return window.alert('Cần mã tham chiếu sau khi đã chuyển khoản thực tế.');
      body.referenceCode = referenceCode.trim();
    } else {
      const note = window.prompt(`Ghi nhận việc trả ${Number(refund.amount).toLocaleString('vi-VN')} ₫ tại quầy:`) || '';
      if (note.trim().length < 3) return window.alert('Cần ghi chú đã trả tiền mặt tại quầy.');
      body.note = note.trim();
    }
    if (!window.confirm('Chỉ xác nhận nếu khoản tiền đã thực sự được chuyển/trả ngoài hệ thống.')) return;
    try { await axiosClient.post(`/appointments/admin/cancellation-requests/${request.id}/refunds/${refund.id}/complete`, body); await fetchAppointments(); }
    catch (error) { window.alert(error.message || 'Không thể ghi nhận hoàn tiền.'); }
  };

  const handleOpenPayment = (app) => {
    setSelectedApp(app);
    setIsPaymentOpen(true);
  };

  const filtered = appointments.filter(app => {
    const matchStatus = filterStatus === 'ALL' || app.status === filterStatus;
    const matchSearch = app.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        app.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleCancellationFilterChange = async (event) => {
    const status = event.target.value;
    setCancellationFilter(status);
    setCancellationLoading(true);
    try {
      const result = await axiosClient.get('/appointments/admin/cancellation-requests', { params: { status } });
      if (result.success) setCancellationRequests(result.data || []);
    } catch (error) { window.alert(error.message || 'Không tải được yêu cầu hủy.'); }
    finally { setCancellationLoading(false); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Lịch Hẹn Khám Toàn Hệ Thống</h2>
          <p className="text-sm text-slate-500 mt-1">Duyệt, điều phối, thu ngân và theo dõi lịch khám của tất cả bệnh nhân.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAppointments}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-lg font-bold text-slate-900">Yêu cầu hủy lịch</h3><p className="mt-1 text-sm text-slate-500">Duyệt/từ chối yêu cầu và chỉ xác nhận hoàn sau khi đã trả tiền bên ngoài hệ thống.</p></div>
          <select value={cancellationFilter} onChange={handleCancellationFilterChange} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="PENDING">Chờ duyệt</option><option value="REFUND_PENDING">Chờ hoàn tiền</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Bị từ chối</option><option value="ALL">Tất cả</option>
          </select>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          {cancellationLoading ? <p className="py-5 text-center text-sm text-slate-500">Đang tải yêu cầu…</p> : cancellationRequests.length === 0 ? <p className="py-5 text-center text-sm text-slate-500">Không có yêu cầu trong bộ lọc này.</p> : cancellationRequests.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-slate-900">Lịch #{item.appointment_id}</strong><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{item.request_source === 'CLINIC' ? 'Hủy từ phía phòng khám' : 'Bệnh nhân yêu cầu hủy'}</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{item.status === 'PENDING' ? 'Chờ duyệt' : item.status === 'REJECTED' ? 'Bị từ chối' : 'Đã duyệt'}</span><span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-800">{refundLabel(item.refund_status)}</span></div>
                  <p><strong>{item.patient_name}</strong> · {item.patient_phone || 'Chưa có số điện thoại'} · Bác sĩ {item.doctor_name}</p>
                  <p>{item.appointment_date} · {item.time_slot} · {item.minutes_until_start < 0 ? `Đã qua ${Math.round(Math.abs(item.minutes_until_start))} phút` : `Còn ${Math.round(item.minutes_until_start)} phút`}</p>
                  {(item.patient_reason || item.clinic_reason) && <p className="whitespace-pre-wrap"><strong>Lý do:</strong> {item.patient_reason || item.clinic_reason}</p>}
                  {item.decision_note && <p className="whitespace-pre-wrap text-rose-800"><strong>Ghi chú quyết định:</strong> {item.decision_note}</p>}
                  <p>Tổng hóa đơn {Number(item.total_amount || 0).toLocaleString('vi-VN')} ₫ · Đã thu {Number(item.paid_amount || 0).toLocaleString('vi-VN')} ₫ · {item.status === 'PENDING' ? `Còn có thể hoàn ${Number(item.refundable_remaining || 0).toLocaleString('vi-VN')} ₫` : `Được duyệt hoàn ${Number(item.approved_refund_amount || 0).toLocaleString('vi-VN')} ₫`}</p>
                  {item.bank_details && <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs"><strong>Thông tin nhận chuyển khoản (Admin):</strong>{item.bank_details.unavailable ? <p>Không giải mã được; kiểm tra khóa REFUND_PII_ENCRYPTION_KEY.</p> : <p>{item.bank_details.accountName} · {item.bank_details.bankName} · {item.bank_details.accountNumber}</p>}</div>}
                  {item.refunds?.length > 0 && <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">{item.refunds.map((refund) => <div key={refund.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs"><strong>{refund.refund_method === 'BANK_TRANSFER' ? 'Chuyển khoản ngân hàng' : 'Trả tiền mặt tại quầy'}</strong> · {Number(refund.amount).toLocaleString('vi-VN')} ₫ · {refund.status === 'COMPLETED' ? 'Đã hoàn' : 'Chờ hoàn'}{refund.reference_code && <p>Mã tham chiếu: {refund.reference_code}</p>}{refund.note && <p>Ghi chú: {refund.note}</p>}</div>{refund.status === 'PENDING' && <button type="button" onClick={() => handleConfirmRefund(item, refund)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Xác nhận đã trả tiền</button>}</div>)}</div>}
                </div>
                {item.status === 'PENDING' && <div className="flex shrink-0 gap-2"><button type="button" onClick={() => handleApproveCancellation(item)} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Duyệt hủy</button><button type="button" onClick={() => handleRejectCancellation(item)} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-800">Từ chối</button></div>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên bệnh nhân hoặc bác sĩ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-semibold">Lọc trạng thái:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING">Chờ xác nhận (PENDING)</option>
            <option value="CONFIRMED">Đã xác nhận (CONFIRMED)</option>
            <option value="COMPLETED">Đã khám xong (COMPLETED)</option>
            <option value="CANCELLED">Đã hủy (CANCELLED)</option>
            <option value="NO_SHOW">Vắng mặt (NO_SHOW)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-6">Mã Lịch</th>
                <th className="py-4 px-6">Bệnh nhân</th>
                <th className="py-4 px-6">Bác sĩ & Phòng khám</th>
                <th className="py-4 px-6">Ngày & Giờ khám</th>
                <th className="py-4 px-6">Trạng thái khám</th>
                <th className="py-4 px-6">Thanh toán</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải lịch hẹn...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Không tìm thấy lịch hẹn phù hợp.</td>
                </tr>
              ) : (
                filtered.map((app) => (
                  (() => {
                    const due = Number(app.amount_due ?? app.invoice_total_amount ?? 0);
                    const paid = Number(app.amount_paid || 0);
                    const paidInFull = due <= 0 || app.payment_status === 'PAID';
                    return <tr key={app.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600">#{app.id}</td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{app.patient_name}</div>
                      <div className="text-xs text-slate-400">{app.patient_phone || 'Không có SĐT'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-800">{app.doctor_name}</div>
                      <div className="text-xs text-slate-400">{app.room_name} ({app.room_number})</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs font-semibold text-slate-700">{app.appointment_date}</div>
                      <div className="text-xs text-slate-400">{app.time_slot}</div>
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={app.status} type="appointment" />
                    </td>
                    <td className="py-4 px-6">
                      {app.invoice_status === 'VOID' || ['CANCELLED', 'NO_SHOW'].includes(app.status) ? (
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Hóa đơn hết hiệu lực</span>
                      ) : paidInFull ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          <Check className="w-3.5 h-3.5" />
                          <span>Đã thanh toán</span>
                        </span>
                      ) : app.payment_method === 'BANK_TRANSFER' ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold text-sky-800">QR · {paid > 0 ? `Đã thu ${paid.toLocaleString('vi-VN')} ₫ · còn ${due.toLocaleString('vi-VN')} ₫` : 'Chờ webhook SePay'}</p>
                          <button onClick={() => handleOpenPayment(app)} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100"><QrCode className="h-3.5 w-3.5" /><span>Xem QR</span></button>
                        </div>
                      ) : app.payment_method === 'CASH' ? (
                        <div className="text-xs text-emerald-800"><p className="font-semibold">Tiền mặt tại quầy</p><p className="mt-1">{paid > 0 ? `Đã thu ${paid.toLocaleString('vi-VN')} ₫ · còn ${due.toLocaleString('vi-VN')} ₫` : 'Chờ Admin xác nhận tại hóa đơn'}</p></div>
                      ) : (
                        <span className="text-xs text-slate-600">Chưa chọn phương thức thanh toán</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {['PENDING', 'CONFIRMED'].includes(app.status) && app.cancellation_request_status !== 'PENDING' && (
                          <button
                            title="Hủy lịch từ phía phòng khám"
                            onClick={() => handleClinicCancel(app)}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {app.status === 'CONFIRMED' && minutesUntilAppointment(app.appointment_date, app.time_slot) <= -15 && (
                          <button title="Đánh dấu vắng sau khi xác minh" onClick={() => handleNoShow(app)} className="rounded-lg bg-amber-50 p-1.5 text-amber-800 hover:bg-amber-100"><span className="text-[10px] font-bold">Vắng</span></button>
                        )}
                      </div>
                    </td>
                  </tr>;
                  })()
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal thanh toán VietQR / Cash */}
      {selectedApp && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          appointmentId={selectedApp.id}
          patientName={selectedApp.patient_name}
          amount={selectedApp.invoice_total_amount}
          lockedPaymentMethod="BANK_TRANSFER"
          onSuccess={() => fetchAppointments()}
        />
      )}
    </div>
  );
};

export default AppointmentMgmt;

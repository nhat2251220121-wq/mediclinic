import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import PaymentModal from '../../components/common/PaymentModal';
import StatusBadge from '../../components/common/StatusBadge';
import { socket } from '../../api/socket';
import { useLocation } from 'react-router-dom';
import { Eye, Calendar, Clock, Stethoscope, Pill, X, Heart, Activity, FileText, Download, ChevronLeft, ChevronRight, QrCode, RefreshCw, Check } from 'lucide-react';

const MedicalHistory = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

    socket.on('payment_updated', handlePaymentCompleted);
    return () => {
      socket.off('payment_updated', handlePaymentCompleted);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appRes, invRes, recordRes] = await Promise.all([
        axiosClient.get('/appointments'),
        axiosClient.get('/invoices'),
        axiosClient.get('/medical-records')
      ]);

      if (appRes.success) setAppointments(appRes.data);
      if (invRes.success) setInvoices(invRes.data);
      if (recordRes.success) setMedicalRecords(recordRes.data || []);
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
    return {
      ...app,
      invoice: matchedInv || null,
      medicalRecord: medicalRecords.find((record) => Number(record.appointment_id) === Number(app.appointment_id || app.id)) || null,
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
                        <div className={`text-[11px] font-semibold ${Number(item.invoice.amount_due) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>Còn thiếu {Number(item.invoice.amount_due).toLocaleString('vi-VN')}đ</div>
                        {Number(item.invoice.amount_due) > 0 && item.status !== 'CANCELLED' && <button onClick={() => handleOpenPaymentModal(item)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-1 text-xs font-bold text-white"><QrCode className="h-3.5 w-3.5" />Trả phần còn thiếu</button>}
                        {item.invoice.cash_requested_at && Number(item.invoice.amount_due) > 0 && <span className="block text-[11px] font-semibold text-amber-700">Tiền mặt tại quầy · đang chờ xác nhận thu</span>}
                        {item.status === 'CANCELLED' && <span className="text-[11px] font-semibold text-amber-700">Lịch đã hủy · liên hệ phòng khám để đối soát</span>}
                        <details className="text-[11px]"><summary className="cursor-pointer text-sky-700">Giao dịch ({item.invoice.payments?.length || 0})</summary><div className="mt-1 space-y-1">{item.invoice.payments?.map((payment) => <p key={payment.payment_id} className="text-slate-600">{payment.payment_method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} · {Number(payment.amount).toLocaleString('vi-VN')}đ · {payment.transaction_code || payment.provider} · {new Date(payment.created_at).toLocaleString('vi-VN')}</p>)}</div></details>
                      </div> : <span className="text-xs text-slate-500">Hóa đơn đang được cập nhật.</span>}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
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

      {/* Modal Chi Tiết Buổi Khám */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 z-10 space-y-6">
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
                <div><strong>Đơn thuốc</strong>{selectedRecord.medicalRecord.prescriptions?.length ? <div className="mt-2 space-y-2">{selectedRecord.medicalRecord.prescriptions.map((drug) => <div key={drug.prescription_id} className="rounded-xl border bg-white p-3"><p className="font-semibold">{drug.medicine_name}{drug.medicine_generic_name ? ` (${drug.medicine_generic_name})` : ''}</p><p className="text-xs text-slate-600">Số lượng: {drug.quantity} {drug.unit_name || ''} · {drug.dosage} · {drug.duration} ngày</p><p className="text-xs text-slate-600">Quan hệ bữa ăn: {drug.meal_name || 'Không chỉ định'} · {drug.instructions || 'Không có hướng dẫn thêm'}</p></div>)}</div> : <p className="mt-1 text-slate-500">Không có thuốc được kê.</p>}</div>
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
              <div className="grid grid-cols-2 gap-3">
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

            {!selectedRecord.isPaid && selectedRecord.status !== 'CANCELLED' && Number(selectedRecord.invoice?.amount_due) > 0 && (
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
          onSuccess={() => fetchData()}
        />
      )}
      <style>{`@media print { body * { visibility: hidden !important; } .patient-invoice-receipt, .patient-invoice-receipt * { visibility: visible !important; } .patient-invoice-receipt { position: fixed !important; inset: 0 !important; border: 0 !important; border-radius: 0 !important; padding: 24px !important; background: white !important; } .patient-receipt-action { display: none !important; } }`}</style>
    </div>
  );
};

export default MedicalHistory;

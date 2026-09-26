import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import StatusBadge from '../../components/common/StatusBadge';
import { Receipt, Check, DollarSign, Calendar, RefreshCw } from 'lucide-react';

const InvoiceMgmt = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices();
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

  const handlePay = async (invoiceId) => {
    try {
      await axiosClient.patch(`/invoices/${invoiceId}/pay`, {
        payment_status: 'PAID',
        payment_method: 'CASH'
      });
      fetchInvoices();
    } catch (err) {
      alert('Lỗi cập nhật thanh toán: ' + (err.message || 'Lỗi'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Thu Ngân & Viện Phí</h2>
          <p className="text-sm text-slate-500 mt-1">Theo dõi hóa đơn khám bệnh, tiền thuốc và thanh toán.</p>
        </div>

        <button
          onClick={fetchInvoices}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Làm mới</span>
        </button>
      </div>

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
                <th className="py-4 px-6">Trạng thái</th>
                <th className="py-4 px-6 text-center">Xác nhận thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Đang tải danh sách hóa đơn...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Chưa có hóa đơn nào được tạo.</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-4 px-6 font-semibold text-sky-600">#INV-{inv.id}</td>
                    <td className="py-4 px-6 font-bold text-slate-800">{inv.patient_name}</td>
                    <td className="py-4 px-6 text-xs text-slate-600">{inv.appointment_date}</td>
                    <td className="py-4 px-6 text-slate-700">{Number(inv.service_fee).toLocaleString()}đ</td>
                    <td className="py-4 px-6 text-slate-700">{Number(inv.medicine_fee).toLocaleString()}đ</td>
                    <td className="py-4 px-6 font-black text-emerald-600">
                      {Number(inv.total_amount).toLocaleString()}đ
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={inv.payment_status} type="payment" />
                    </td>
                    <td className="py-4 px-6 text-center">
                      {inv.payment_status === 'UNPAID' ? (
                        <button
                          onClick={() => handlePay(inv.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          Thu tiền
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">Đã hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InvoiceMgmt;

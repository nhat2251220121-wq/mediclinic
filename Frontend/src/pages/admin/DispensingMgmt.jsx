import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { socket } from '../../api/socket';
import { RefreshCw, Pill, Check, AlertTriangle } from 'lucide-react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const DispensingMgmt = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await axiosClient.get('/medical-records/pending-dispensing');
      setRows(response.data || []);
      setError('');
    } catch (requestError) { setError(requestError.message || 'Không tải được danh sách đơn thuốc.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const refresh = () => load();
    socket.on('prescriptions_updated', refresh);
    socket.on('payment_updated', refresh);
    return () => { socket.off('prescriptions_updated', refresh); socket.off('payment_updated', refresh); };
  }, []);

  const groups = useMemo(() => {
    const grouped = new Map();
    for (const row of rows) {
      if (!grouped.has(row.record_id)) grouped.set(row.record_id, { ...row, items: [] });
      grouped.get(row.record_id).items.push(row);
    }
    return [...grouped.values()];
  }, [rows]);

  const deliveryIssue = (record) => {
    if (record.items.some((item) => item.dispensing_source !== 'CLINIC')) return 'Đơn cũ chưa ghi nguồn cấp hoặc không còn ở trạng thái phòng khám cấp; cần đối soát thủ công.';
    if (record.items.some((item) => item.billing_status !== 'BILLED')) return 'Có dòng thuốc chưa được lập hóa đơn. Hệ thống không tự chỉnh hóa đơn lịch sử.';
    if (Number(record.items[0]?.amount_paid) < Number(record.items[0]?.invoice_total)) return `Hóa đơn chưa thanh toán đủ: còn thiếu ${money(Number(record.items[0]?.invoice_total) - Number(record.items[0]?.amount_paid))}.`;
    const required = new Map();
    for (const item of record.items) required.set(item.drug_id, (required.get(item.drug_id) || 0) + Number(item.prescribed_quantity));
    for (const item of record.items) if (required.get(item.drug_id) > Number(item.available_quantity)) return `Không đủ lô còn hạn cho ${item.medicine_name}: cần ${required.get(item.drug_id)}, có ${Number(item.available_quantity)}.`;
    return '';
  };

  const confirmDispensing = async (record) => {
    const issue = deliveryIssue(record);
    if (issue) { setError(issue); return; }
    const summary = record.items.map((item) => `• ${item.medicine_name}: ${item.prescribed_quantity} ${item.unit_name || 'đơn vị'} · đã tính tiền · còn hạn có thể cấp ${item.available_quantity}`).join('\n');
    if (!window.confirm(`Xác nhận đã giao thuốc cho ${record.patient_name}?\n${summary}\nHóa đơn đã thanh toán đủ. Kho sẽ trừ theo lô hết hạn gần nhất; không thay đổi đơn thuốc hoặc hóa đơn.`)) return;
    setSavingId(record.record_id); setError(''); setNotice('');
    try {
      const result = await axiosClient.post(`/medical-records/${record.record_id}/dispense`, {});
      setNotice(result.message || 'Đã xác nhận giao thuốc và ghi lịch sử kho.');
      await load();
    } catch (requestError) { setError(requestError.message || 'Không xác nhận được giao thuốc. Chưa cập nhật tồn; hãy tải lại và kiểm tra.'); }
    finally { setSavingId(null); }
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5">
      <div><h1 className="text-2xl font-bold text-slate-900">Xác nhận giao thuốc</h1><p className="mt-1 text-sm text-slate-500">Bác sĩ đã chọn nguồn cấp khi kê. Admin chỉ xác nhận giao sau khi hóa đơn thanh toán đủ; thao tác giao trừ kho theo FEFO.</p></div>
      <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải đơn thuốc…</div> : groups.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Không có thuốc phòng khám chờ giao.</div> : groups.map((record) => {
      const issue = deliveryIssue(record);
      const totalAmount = Number(record.items[0]?.invoice_total || 0);
      const paidAmount = Number(record.items[0]?.amount_paid || 0);
      return <section key={record.record_id} className="space-y-4 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
          <div><h2 className="font-bold text-slate-900">Lịch #{record.appointment_id} · {record.patient_name}</h2><p className="text-sm text-slate-600">{record.patient_phone || 'Chưa có số điện thoại'} · {record.doctor_name} · {String(record.appointment_date).slice(0, 10)} {record.time_slot}</p></div>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold">Bệnh án #{record.record_id}</span>
        </div>
        <p className="text-sm">Hóa đơn: {money(totalAmount)} · Đã thu: {money(paidAmount)} · Còn thiếu: {money(Math.max(0, totalAmount - paidAmount))}</p>
        {issue && <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue}</p>}
        <div className="space-y-3">{record.items.map((item) => <div key={item.prescription_id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-2 font-semibold"><Pill className="h-4 w-4 text-sky-700" />{item.medicine_name}</div>
          <p className="mt-1 text-sm text-slate-600">Kê: {item.prescribed_quantity} {item.unit_name || 'đơn vị'} · {item.dosage} · {item.frequency || 'Liều theo đơn'} · {item.duration} ngày</p>
          <p className="text-sm text-slate-600">Giá snapshot: {money(item.invoice_unit_price)} · Thành tiền {money(Number(item.invoice_unit_price) * Number(item.prescribed_quantity))} · Tồn tổng {item.stock_quantity} · Lô còn hạn {item.available_quantity}</p>
        </div>)}</div>
        <div className="flex justify-end"><button disabled={Boolean(issue) || savingId === record.record_id} onClick={() => confirmDispensing(record)} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" />{savingId === record.record_id ? 'Đang xác nhận…' : 'Xác nhận đã giao thuốc'}</button></div>
      </section>;
    })}
  </div>;
};

export default DispensingMgmt;

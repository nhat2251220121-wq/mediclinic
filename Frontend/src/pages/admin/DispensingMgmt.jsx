import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { socket } from '../../api/socket';
import { RefreshCw, Pill, Check } from 'lucide-react';

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
      setRows((response.data || []).map((row) => ({ ...row, action: '' })));
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

  const setAction = (prescriptionId, action) => setRows((current) => current.map((row) => row.prescription_id === prescriptionId ? { ...row, action } : row));

  const confirmDispensing = async (record) => {
    const missing = record.items.filter((item) => !item.action);
    if (missing.length) { setError('Chọn kết quả cho từng thuốc: cấp tại phòng khám hoặc bệnh nhân mua ngoài.'); return; }
    const summary = record.items.filter((item) => item.action === 'DISPENSE').map((item) => `• ${item.medicine_name}: ${item.prescribed_quantity} ${item.unit_name || 'đơn vị'} · phí đã được tính lúc lưu đơn`).join('\n');
    if (!window.confirm(`Xác nhận giao thuốc cho ${record.patient_name}?\n${summary}\nBước này chỉ trừ tồn kho, không tạo phí hoặc dòng hóa đơn mới.`)) return;
    setSavingId(record.record_id); setError(''); setNotice('');
    try {
      const result = await axiosClient.post(`/medical-records/${record.record_id}/dispense`, {
        outcomes: record.items.map(({ prescription_id, action }) => ({ prescription_id, action }))
      });
      const due = Number(result.data?.amount_due || 0);
      setNotice(due > 0
        ? `Hóa đơn còn thiếu ${money(due)}. Chưa giao thuốc và chưa trừ kho; bệnh nhân cần thanh toán đủ trước.`
        : 'Đã lưu giao thuốc; phí thuốc không bị tính lại, chỉ tồn kho được cập nhật.');
      await load();
    } catch (requestError) { setError(requestError.message || 'Không xác nhận được cấp thuốc. Tải lại và kiểm tra tồn kho.'); }
    finally { setSavingId(null); }
  };

  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5">
      <div><h1 className="text-2xl font-bold text-slate-900">Xác nhận giao thuốc</h1><p className="mt-1 text-sm text-slate-500">Phí thuốc được lập khi bác sĩ lưu đơn; trang này chỉ quản lý giao nhận và tồn kho.</p></div>
      <button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Làm mới</button>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Đang tải đơn thuốc…</div> : groups.length === 0 ? <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Không có đơn thuốc chờ xử lý.</div> : groups.map((record) => <section key={record.record_id} className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div><h2 className="font-bold text-slate-900">Lịch #{record.appointment_id} · {record.patient_name}</h2><p className="text-sm text-slate-600">{record.patient_phone || 'Chưa có số điện thoại'} · {record.doctor_name} · {String(record.appointment_date).slice(0, 10)} {record.time_slot}</p></div>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold">Bệnh án #{record.record_id}</span>
      </div>
      <div className="space-y-3">{record.items.map((item) => <div key={item.prescription_id} className="grid items-center gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1fr_auto]">
        <div><div className="flex items-center gap-2 font-semibold"><Pill className="h-4 w-4 text-sky-700" />{item.medicine_name}</div><p className="mt-1 text-sm text-slate-600">Kê: {item.prescribed_quantity} {item.unit_name || 'đơn vị'} · {item.dosage} · {item.frequency} · tồn {item.stock_quantity}</p><p className="text-sm text-slate-600">Đơn giá snapshot: {money(item.invoice_unit_price)} · thành tiền {money(Number(item.invoice_unit_price) * Number(item.prescribed_quantity))} · {item.billing_status === 'BILLED' ? 'đã lập phí' : 'đơn cũ cần lập phí trước khi giao'}</p></div>
        <fieldset className="flex flex-wrap gap-3 text-sm"><legend className="sr-only">Kết quả xử lý {item.medicine_name}</legend><label className="inline-flex items-center gap-2"><input type="radio" name={`prescription-${item.prescription_id}`} checked={item.action === 'DISPENSE'} onChange={() => setAction(item.prescription_id, 'DISPENSE')} />Cấp tại phòng khám</label><label className="inline-flex items-center gap-2"><input type="radio" name={`prescription-${item.prescription_id}`} checked={item.action === 'EXTERNAL'} onChange={() => setAction(item.prescription_id, 'EXTERNAL')} />Mua ngoài / không cấp</label></fieldset>
      </div>)}</div>
      <div className="flex justify-end"><button disabled={savingId === record.record_id} onClick={() => confirmDispensing(record)} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{savingId === record.record_id ? 'Đang lưu…' : 'Lưu kết quả cấp thuốc'}</button></div>
    </section>)}
  </div>;
};

export default DispensingMgmt;

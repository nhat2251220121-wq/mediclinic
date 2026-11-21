import React, { useEffect, useMemo, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { socket } from '../../api/socket';
import Modal from '../../components/common/Modal';
import { RefreshCw, Pill, Check, AlertTriangle, Search, X, ArrowDownWideNarrow } from 'lucide-react';

const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const formatClinicDate = (value) => {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Chưa có ngày';
};

const DispensingMgmt = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dispensingConfirmation, setDispensingConfirmation] = useState(null);
  const [dispensingConfirmationError, setDispensingConfirmationError] = useState('');
  const [activeTab, setActiveTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('NEWEST');

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

  const getGroupStatus = (record) => {
    const items = record.items || [];
    if (items.length && items.every((item) => item.dispensing_source === 'CLINIC'
      && item.dispensing_status === 'DISPENSED'
      && Number(item.dispensed_quantity) >= Number(item.prescribed_quantity))) return 'DELIVERED';
    if (items.length && items.every((item) => item.dispensing_source === 'CLINIC'
      && item.dispensing_status === 'PRESCRIBED'
      && item.billing_status === 'BILLED')) return 'PENDING';
    return 'RECONCILIATION';
  };

  const groupCounts = useMemo(() => groups.reduce((counts, record) => {
    counts[getGroupStatus(record)] += 1;
    return counts;
  }, { PENDING: 0, DELIVERED: 0, RECONCILIATION: 0 }), [groups]);

  const visibleGroups = useMemo(() => {
    const normalize = (value) => String(value ?? '').toLocaleLowerCase('vi').replace(/[đ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const query = normalize(search);
    const numericQuery = query.replace(/\D/g, '');
    return groups.filter((record) => {
      if (getGroupStatus(record) !== activeTab) return false;
      if (!query) return true;
      const searchableText = normalize(`${record.patient_name} ${record.patient_phone} ${record.appointment_id} ${record.record_id}`);
      const phoneDigits = String(record.patient_phone || '').replace(/\D/g, '');
      return searchableText.includes(query) || (numericQuery.length > 0 && (phoneDigits.includes(numericQuery)
        || String(record.appointment_id).includes(numericQuery) || String(record.record_id).includes(numericQuery)));
    }).sort((left, right) => {
      if (sortBy === 'NAME') return String(left.patient_name || '').localeCompare(String(right.patient_name || ''), 'vi', { sensitivity: 'base' });
      const dateKey = (record) => `${String(record.appointment_date || '').slice(0, 10)} ${String(record.time_slot || '').slice(0, 5)}`;
      const comparison = dateKey(left).localeCompare(dateKey(right));
      return sortBy === 'OLDEST' ? comparison : -comparison;
    });
  }, [groups, activeTab, search, sortBy]);

  const deliveryIssue = (record) => {
    if (record.items.some((item) => item.dispensing_source !== 'CLINIC')) return 'Đơn cũ chưa ghi nguồn cấp hoặc không còn ở trạng thái phòng khám cấp; cần đối soát thủ công.';
    if (record.items.some((item) => item.dispensing_status !== 'PRESCRIBED')) return 'Trạng thái cấp phát không đồng nhất; cần đối soát thủ công trước khi giao.';
    if (record.items.some((item) => item.billing_status !== 'BILLED')) return 'Có dòng thuốc chưa được lập hóa đơn. Hệ thống không tự chỉnh hóa đơn lịch sử.';
    if (Number(record.items[0]?.amount_paid) < Number(record.items[0]?.invoice_total)) return `Hóa đơn chưa thanh toán đủ: còn thiếu ${money(Number(record.items[0]?.invoice_total) - Number(record.items[0]?.amount_paid))}.`;
    const required = new Map();
    for (const item of record.items) required.set(item.drug_id, (required.get(item.drug_id) || 0) + Number(item.prescribed_quantity));
    for (const item of record.items) if (required.get(item.drug_id) > Number(item.available_quantity)) return `Không đủ lô còn hạn cho ${item.medicine_name}: cần ${required.get(item.drug_id)}, có ${Number(item.available_quantity)}.`;
    return '';
  };

  const confirmDispensing = (record) => {
    const issue = deliveryIssue(record);
    if (issue) { setError(issue); return; }
    setError('');
    setDispensingConfirmationError('');
    setDispensingConfirmation(record);
  };

  const submitDispensing = async () => {
    if (!dispensingConfirmation || savingId) return;
    const record = dispensingConfirmation;
    setSavingId(record.record_id); setError(''); setNotice('');
    try {
      const result = await axiosClient.post(`/medical-records/${record.record_id}/dispense`, {});
      setDispensingConfirmation(null);
      setNotice(result.message || 'Đã xác nhận giao thuốc và ghi lịch sử kho.');
      await load();
    } catch (requestError) { setDispensingConfirmationError(requestError.message || 'Không xác nhận được giao thuốc. Chưa cập nhật tồn; hãy tải lại và kiểm tra.'); }
    finally { setSavingId(null); }
  };

  return <div className="min-w-0 space-y-5">
    <header className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0"><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Xác nhận giao thuốc</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Bác sĩ đã chọn nguồn cấp khi kê. Admin chỉ xác nhận giao sau khi hóa đơn thanh toán đủ; thao tác giao trừ kho theo FEFO.</p></div>
      <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>
    </header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}

    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Tìm kiếm và lọc đơn giao thuốc">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block min-w-0"><span className="sr-only">Tìm bệnh nhân, số điện thoại, mã lịch hoặc mã bệnh án</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, số điện thoại, mã lịch hoặc mã bệnh án" className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-10 text-sm focus:border-teal-600 focus:bg-white focus:outline-none" />{search && <button type="button" aria-label="Xóa từ khóa tìm kiếm" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-200"><X className="h-4 w-4" /></button>}</label>
        <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm"><ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-slate-500" /><span className="shrink-0 text-slate-600">Sắp xếp</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm focus:ring-0"><option value="NEWEST">Ngày khám mới nhất</option><option value="OLDEST">Ngày khám cũ nhất</option><option value="NAME">Tên bệnh nhân A–Z</option></select></label>
      </div>
      <div className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3" role="tablist" aria-label="Tình trạng cấp thuốc">
        {[
          ['PENDING', 'Chưa giao thuốc', 'text-teal-800'],
          ['DELIVERED', 'Đã giao thuốc', 'text-emerald-800'],
          ['RECONCILIATION', 'Cần đối soát', 'text-amber-800']
        ].map(([key, label, tone]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${activeTab === key ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-600/20' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><span>{label}</span><span className={`rounded-full bg-white px-2 py-0.5 text-xs tabular-nums ${tone}`}>{groupCounts[key]}</span></button>)}
      </div>
    </section>

    {loading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải danh sách cấp phát…</div> : visibleGroups.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p className="text-sm text-slate-600">{search ? 'Không tìm thấy đơn nào khớp với từ khóa trong nhóm này.' : activeTab === 'PENDING' ? 'Không có đơn thuốc phòng khám nào đang chờ giao.' : activeTab === 'DELIVERED' ? 'Chưa có đơn thuốc nào được xác nhận giao.' : 'Không có đơn thuốc cần đối soát.'}</p>
      {search && <button type="button" onClick={() => setSearch('')} className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"><X className="h-4 w-4" />Xóa từ khóa tìm kiếm</button>}
    </div> : <div className="space-y-4">{visibleGroups.map((record) => {
      const groupStatus = getGroupStatus(record);
      const issue = groupStatus === 'PENDING' ? deliveryIssue(record) : '';
      const reconciliationIssue = groupStatus === 'RECONCILIATION' ? deliveryIssue(record) || 'Trạng thái nguồn cấp và trạng thái giao thuốc không khớp; cần đối soát thủ công.' : '';
      const totalAmount = Number(record.items[0]?.invoice_total || 0);
      const paidAmount = Number(record.items[0]?.amount_paid || 0);
      const deliveredAt = record.items.map((item) => item.dispensed_at).filter(Boolean).sort().at(-1);
      const deliveredBy = record.items.find((item) => item.dispensed_by_name)?.dispensed_by_name;
      return <article key={record.record_id} className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <header className="flex min-w-0 flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-start">
          <div className="min-w-0"><h2 className="break-words font-bold text-slate-900">Lịch #{record.appointment_id} · {record.patient_name}</h2><p className="mt-1 break-words text-sm text-slate-600">{record.patient_phone || 'Chưa có số điện thoại'} · {record.doctor_name}</p><p className="text-sm text-slate-600">{formatClinicDate(record.appointment_date)} {record.time_slot}</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold">Bệnh án #{record.record_id}</span><span className={`rounded-lg px-2 py-1 text-xs font-semibold ${groupStatus === 'DELIVERED' ? 'bg-emerald-50 text-emerald-800' : groupStatus === 'RECONCILIATION' ? 'bg-amber-50 text-amber-800' : 'bg-teal-50 text-teal-800'}`}>{groupStatus === 'DELIVERED' ? 'Đã giao thuốc' : groupStatus === 'RECONCILIATION' ? 'Cần đối soát' : 'Chưa giao thuốc'}</span></div>
        </header>
        {groupStatus !== 'RECONCILIATION' && <p className="break-words text-sm">Hóa đơn: {money(totalAmount)} · Đã thu: {money(paidAmount)} · Còn thiếu: {money(Math.max(0, totalAmount - paidAmount))}</p>}
        {issue && <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue}</p>}
        {reconciliationIssue && <p role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{reconciliationIssue}</p>}
        <div className="grid min-w-0 gap-3">{record.items.map((item) => <div key={item.prescription_id} className="min-w-0 rounded-xl border border-slate-200 p-3">
          <div className="flex min-w-0 items-start gap-2 font-semibold"><Pill className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /><span className="break-words">{item.medicine_name}</span></div>
          <p className="mt-1 break-words text-sm text-slate-600">Kê: {item.prescribed_quantity} {item.unit_name || 'đơn vị'} · {item.dosage} · {item.frequency || 'Liều theo đơn'} · {item.duration} ngày</p>
          <p className="break-words text-sm text-slate-600">Giá snapshot: {money(item.invoice_unit_price)} · Thành tiền {money(Number(item.invoice_unit_price) * Number(item.prescribed_quantity))} · Tồn tổng {item.stock_quantity} · Lô còn hạn {item.available_quantity}</p>
          <p className="mt-1 text-xs text-slate-500">Trạng thái cấp: {item.dispensing_status === 'DISPENSED' ? 'Đã giao' : item.dispensing_status === 'NOT_DISPENSED' ? 'Không giao tại phòng khám' : 'Chưa giao'} · Nguồn: {item.dispensing_source || 'Chưa ghi nhận'}</p>
        </div>)}</div>
        {groupStatus === 'DELIVERED' && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Đã xác nhận giao{deliveredBy ? ` bởi ${deliveredBy}` : ''}{deliveredAt ? ` · ${new Date(deliveredAt).toLocaleString('vi-VN')}` : ''}. Chỉ xem; không thể giao hoặc trừ kho lần nữa.</p>}
        {groupStatus === 'RECONCILIATION' && <details className="rounded-xl border border-amber-200 bg-amber-50/50 p-3"><summary className="min-h-10 cursor-pointer text-sm font-semibold text-amber-900">Xem thông tin cần đối soát</summary><p className="mt-2 break-words text-sm text-amber-900">{reconciliationIssue}</p><p className="mt-2 text-xs text-amber-800">Dữ liệu đơn thuốc và tồn kho được giữ nguyên. Hãy đối chiếu với hồ sơ/hóa đơn trước khi xử lý theo quy trình hiện có.</p></details>}
        {groupStatus === 'PENDING' && <div className="flex justify-stretch sm:justify-end"><button type="button" disabled={Boolean(issue) || savingId === record.record_id} onClick={() => confirmDispensing(record)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Check className="h-4 w-4" />{savingId === record.record_id ? 'Đang xác nhận…' : 'Xác nhận đã giao thuốc'}</button></div>}
      </article>;
    })}</div>}
    <Modal
      isOpen={Boolean(dispensingConfirmation)}
      onClose={() => { if (!savingId) { setDispensingConfirmation(null); setDispensingConfirmationError(''); } }}
      title="Xác nhận đã giao thuốc"
      maxWidth="max-w-xl"
    >
      {dispensingConfirmation && <div className="space-y-4">
        <p className="text-sm leading-6 text-slate-600">Xác nhận sau khi đã giao đủ thuốc trực tiếp cho bệnh nhân. Khi hoàn tất, hệ thống ghi nhận bàn giao và trừ kho theo lô hết hạn gần nhất (FEFO).</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-semibold text-slate-900">{dispensingConfirmation.patient_name} · Lịch #{dispensingConfirmation.appointment_id}</p>
          <ul className="mt-3 space-y-2">
            {dispensingConfirmation.items.map((item) => <li key={item.prescription_id} className="flex flex-col gap-1 border-t border-slate-200 pt-2 text-sm sm:flex-row sm:justify-between">
              <span className="font-medium text-slate-800">{item.medicine_name} · {item.prescribed_quantity} {item.unit_name || 'đơn vị'}</span>
              <span className="text-slate-600">Còn hạn có thể cấp: {item.available_quantity}</span>
            </li>)}
          </ul>
          <p className="mt-3 border-t border-slate-200 pt-3 text-sm font-semibold text-emerald-800">Hóa đơn đã thanh toán đủ: {money(dispensingConfirmation.items[0]?.invoice_total)}</p>
        </div>
        <p className="text-xs text-slate-500">Thao tác này không sửa đơn thuốc hoặc hóa đơn.</p>
        {dispensingConfirmationError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{dispensingConfirmationError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={savingId === dispensingConfirmation.record_id} onClick={() => setDispensingConfirmation(null)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Để sau</button>
          <button type="button" disabled={savingId === dispensingConfirmation.record_id} onClick={submitDispensing} className="min-h-11 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingId === dispensingConfirmation.record_id ? 'Đang ghi nhận…' : 'Xác nhận đã giao'}</button>
        </div>
      </div>}
    </Modal>
  </div>;
};

export default DispensingMgmt;

import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Pill, Plus, Search, Edit, Trash2, X, RefreshCw, Save, Check, Boxes, AlertTriangle } from 'lucide-react';

const todayVietnam = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const formatVietnamDate = (value) => {
  if (!value) return 'Chưa cập nhật';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const getMedicineAlertSummary = (drug) => {
  const alerts = [
    Number(drug.expired_quantity) > 0 && { label: 'Có lô hết hạn', className: 'border-rose-200 bg-rose-50 text-rose-800' },
    drug.is_low_stock && { label: 'Tồn thấp', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    (Number(drug.expiring_30_quantity) > 0 || Number(drug.expiring_60_quantity) > 0 || Number(drug.expiring_90_quantity) > 0) && { label: 'Sắp hết hạn', className: 'border-orange-200 bg-orange-50 text-orange-800' },
    Number(drug.untracked_quantity) > 0 && { label: 'Chưa rõ hạn', className: 'border-slate-200 bg-slate-100 text-slate-700' }
  ].filter(Boolean);
  return alerts;
};

const getExpirySummary = (drug) => {
  if (Number(drug.expired_quantity) > 0) return { label: 'Có lô hết hạn', detail: `${Number(drug.expired_quantity)} còn lại`, tone: 'text-rose-700' };
  if (Number(drug.expiring_30_quantity) > 0) return { label: 'Trong 30 ngày', detail: `${Number(drug.expiring_30_quantity)} còn lại`, tone: 'text-orange-700' };
  if (Number(drug.expiring_60_quantity) > 0) return { label: 'Trong 31–60 ngày', detail: `${Number(drug.expiring_60_quantity)} còn lại`, tone: 'text-amber-700' };
  if (Number(drug.expiring_90_quantity) > 0) return { label: 'Trong 61–90 ngày', detail: `${Number(drug.expiring_90_quantity)} còn lại`, tone: 'text-amber-700' };
  if (Number(drug.usable_quantity) > 0) return { label: 'Chưa cận hạn', detail: 'Không có lô gần hạn trong 90 ngày', tone: 'text-slate-600' };
  if (Number(drug.untracked_quantity) > 0) return { label: 'Chưa xác định hạn', detail: 'Tồn chưa rõ lô', tone: 'text-slate-600' };
  return { label: 'Chưa có lô', detail: 'Chưa có hạn dùng', tone: 'text-slate-500' };
};

const MedicineMgmt = () => {
  const [activeTab, setActiveTab] = useState('drugs');
  const [drugs, setDrugs] = useState([]);
  const [units, setUnits] = useState([]);
  const [mealRelations, setMealRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealRelationsLoading, setMealRelationsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [relationSearch, setRelationSearch] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [pendingRelationId, setPendingRelationId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [stockFilter, setStockFilter] = useState('ALL');
  const [lotsDrug, setLotsDrug] = useState(null);
  const [lotsData, setLotsData] = useState(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotAction, setLotAction] = useState(null);
  const [lotNotice, setLotNotice] = useState(null);
  const [lotForm, setLotForm] = useState({ batch_code: '', quantity: '', received_on: todayVietnam(), expires_on: '', quantity_delta: '', reason_type: 'EXPIRED', note: '' });

  // Modal State cho Thêm / Sửa thuốc
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    activeIngredient: '',
    packing: '',
    sideEffect: '',
    price: '',
    low_stock_threshold: 10,
    unit_id: ''
  });
  const [isMealRelationModalOpen, setIsMealRelationModalOpen] = useState(false);
  const [editingMealRelation, setEditingMealRelation] = useState(null);
  const [mealRelationForm, setMealRelationForm] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchMedicines();
    fetchMealRelations();
    axiosClient.get('/admin/medicine-units').then((response) => setUnits(response.data || [])).catch(() => setUnits([]));
  }, []);

  const fetchMedicines = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/medicines');
      if (res.success) {
        setDrugs(res.data);
      }
    } catch (err) {
      console.error('Lỗi lấy danh sách thuốc:', err);
      setActionNotice({ type: 'error', message: 'Không tải được danh sách thuốc. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchMealRelations = async () => {
    setMealRelationsLoading(true);
    try {
      const res = await axiosClient.get('/admin/meal-relations');
      if (res.success) setMealRelations(res.data || []);
    } catch (err) {
      console.error('Lỗi lấy quan hệ bữa ăn:', err);
      setActionNotice({ type: 'error', message: err.message || 'Không tải được danh sách quan hệ bữa ăn.' });
    } finally {
      setMealRelationsLoading(false);
    }
  };

  const openCreateMealRelation = () => {
    setEditingMealRelation(null);
    setMealRelationForm({ name: '', description: '' });
    setIsMealRelationModalOpen(true);
  };

  const openEditMealRelation = (relation) => {
    setEditingMealRelation(relation);
    setMealRelationForm({ name: relation.name || '', description: relation.description || '' });
    setIsMealRelationModalOpen(true);
  };

  const saveMealRelation = async (event) => {
    event.preventDefault();
    try {
      if (editingMealRelation) {
        await axiosClient.put(`/admin/meal-relations/${editingMealRelation.relation_id}`, mealRelationForm);
      } else {
        await axiosClient.post('/admin/meal-relations', mealRelationForm);
      }
      setIsMealRelationModalOpen(false);
      await fetchMealRelations();
    } catch (err) {
      alert('Lỗi lưu quan hệ bữa ăn: ' + (err.message || 'Lỗi server'));
    }
  };

  const setMealRelationActive = async (relation) => {
    const active = Boolean(relation.is_active);
    const action = active ? 'ngừng sử dụng' : 'kích hoạt lại';
    if (!window.confirm(`Bạn có chắc muốn ${action} “${relation.name}”?`)) return;
    setPendingRelationId(relation.relation_id); setActionNotice(null);
    try {
      if (active) await axiosClient.delete(`/admin/meal-relations/${relation.relation_id}`);
      else await axiosClient.put(`/admin/meal-relations/${relation.relation_id}`, { ...relation, is_active: true });
      setActionNotice({ type: 'success', message: active ? `Đã ngừng “${relation.name}”; đơn thuốc cũ vẫn được giữ.` : `Đã kích hoạt “${relation.name}”.` });
      await fetchMealRelations();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không cập nhật được quan hệ bữa ăn.' });
    } finally { setPendingRelationId(null); }
  };

  const handleOpenCreateModal = () => {
    setEditingDrug(null);
    setFormData({
      name: '',
      activeIngredient: '',
      packing: '',
      sideEffect: '',
      price: '',
      low_stock_threshold: 10,
      unit_id: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (drug) => {
    setEditingDrug(drug);
    setFormData({
      name: drug.name || '',
      activeIngredient: drug.activeIngredient || '',
      packing: drug.packing || '',
      sideEffect: drug.sideEffect || '',
      price: drug.price ?? '',
      low_stock_threshold: drug.low_stock_threshold ?? 10,
      unit_id: drug.unit_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, price: Number(formData.price), low_stock_threshold: Number(formData.low_stock_threshold), unit_id: formData.unit_id || null };
      if (editingDrug) await axiosClient.put(`/admin/medicines/${editingDrug.id}`, payload);
      else await axiosClient.post('/admin/medicines', payload);
      setIsModalOpen(false);
      setActionNotice({ type: 'success', message: 'Đã lưu thuốc. Nhập tồn kho qua quản lý lô để ghi ngày hết hạn và lịch sử.' });
      await fetchMedicines();
    } catch (err) {
      alert('Lỗi lưu thuốc: ' + (err.message || 'Lỗi server'));
    }
  };

  const handleDeleteDrug = async (drug) => {
    if (!window.confirm(`Ngừng sử dụng thuốc “${drug.name}”? Thuốc sẽ không còn dùng cho đơn mới; đơn thuốc và lịch sử cấp phát cũ được giữ nguyên.`)) return;
    setPendingDeleteId(drug.id); setActionNotice(null);
    try {
      const result = await axiosClient.delete(`/admin/medicines/${drug.id}`);
      setDrugs((current) => current.map((item) => item.id === drug.id ? { ...item, is_active: false } : item));
      setActionNotice({ type: 'success', message: result.message || `Đã ngừng sử dụng “${drug.name}”.` });
      await fetchMedicines();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không ngừng được thuốc. Dữ liệu chưa bị xóa.' });
    } finally { setPendingDeleteId(null); }
  };

  const filteredDrugs = drugs.filter(d =>
    (d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (stockFilter === 'ALL' || (stockFilter === 'ACTIVE' && d.is_active) || (stockFilter === 'INACTIVE' && !d.is_active) ||
      (stockFilter === 'LOW' && Number(d.usable_quantity) <= Number(d.low_stock_threshold)) ||
      (stockFilter === 'EXPIRING' && Number(d.expiring_90_quantity) > 0) || (stockFilter === 'EXPIRED' && Number(d.expired_quantity) > 0) ||
      (stockFilter === 'UNKNOWN' && Number(d.untracked_quantity) > 0))
  );

  const openLots = async (drug, action = null, preserveNotice = false) => {
    setLotsDrug(drug); setLotsData(null); setLotAction(action); if (!preserveNotice) setLotNotice(null); setLotsLoading(true);
    try { const response = await axiosClient.get(`/admin/medicines/${drug.id}/lots`); setLotsData(response.data); }
    catch (err) { setActionNotice({ type: 'error', message: err.message || 'Không tải được lô và lịch sử kho.' }); setLotsDrug(null); }
    finally { setLotsLoading(false); }
  };

  const submitLotAction = async (event) => {
    event.preventDefault();
    if (!lotsDrug || !lotAction) return;
    const title = lotAction === 'RECEIVE' ? `Nhập ${lotForm.quantity} đơn vị vào kho thuốc ${lotsDrug.name}` : lotAction === 'CLASSIFY' ? `Gắn lô đã xác minh cho ${lotForm.quantity} đơn vị tồn cũ của ${lotsDrug.name}` : lotAction === 'ADJUST' ? `Điều chỉnh ${lotForm.quantity_delta} đơn vị của lô thuốc ${lotsDrug.name}` : `Ghi nhận hủy ${lotForm.quantity} đơn vị thuốc ${lotsDrug.name}`;
    if (lotAction !== 'RECEIVE' && !window.confirm(`${title}? Lý do: ${lotForm.note || 'chưa nhập'}`)) return;
    try {
      if (lotAction === 'RECEIVE') await axiosClient.post(`/admin/medicines/${lotsDrug.id}/lots`, lotForm);
      if (lotAction === 'CLASSIFY') await axiosClient.post(`/admin/medicines/${lotsDrug.id}/lots/classify`, lotForm);
      if (lotAction === 'ADJUST') await axiosClient.post(`/admin/medicine-lots/${lotForm.batch_id}/adjust`, { quantity_delta: Number(lotForm.quantity_delta), note: lotForm.note });
      if (lotAction === 'WRITE_OFF') await axiosClient.post(`/admin/medicine-lots/${lotForm.batch_id}/write-off`, { quantity: Number(lotForm.quantity), reason_type: lotForm.reason_type, note: lotForm.note });
      setLotNotice({ type: 'success', message: result?.message || 'Đã ghi nhận thao tác kho và lịch sử.' });
      setLotAction(null);
      await fetchMedicines(); await openLots(lotsDrug, null, true);
    } catch (err) { setLotNotice({ type: 'error', message: err.message || 'Không cập nhật được lô thuốc.' }); }
  };

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('drugs')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'drugs' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Danh mục thuốc
          </button>
          <button
            onClick={() => setActiveTab('mealRelations')}
            className={`px-5 py-2.5 rounded-xl transition ${activeTab === 'mealRelations' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Quan hệ bữa ăn
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={activeTab === 'drugs' ? fetchMedicines : fetchMealRelations}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            <span>Làm mới</span>
          </button>
          <button
            onClick={activeTab === 'drugs' ? handleOpenCreateModal : openCreateMealRelation}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{activeTab === 'drugs' ? '+ Thêm mới thuốc' : '+ Thêm quan hệ bữa ăn'}</span>
          </button>
        </div>
      </div>

      {activeTab === 'drugs' && <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách dược phẩm phòng khám</h3>
          <div className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên thuốc hoặc hoạt chất..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-600" htmlFor="medicine-stock-filter">Lọc tồn/hạn</label>
          <select id="medicine-stock-filter" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <option value="ALL">Tất cả</option><option value="ACTIVE">Đang kinh doanh</option><option value="INACTIVE">Đã ngừng kinh doanh</option><option value="LOW">Tồn thấp</option><option value="EXPIRING">Sắp hết hạn (90 ngày)</option><option value="EXPIRED">Đã hết hạn</option><option value="UNKNOWN">Chưa xác định hạn</option>
          </select>
          <p className="text-xs leading-5 text-slate-500">Tồn dùng được chỉ tính từ lô chưa hết hạn; tồn cũ chưa rõ lô được giữ riêng và không thể giao.</p>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Đang tải danh sách thuốc...</div> : filteredDrugs.length === 0 ? <div className="rounded-2xl border border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Chưa có dữ liệu thuốc phù hợp bộ lọc.</div> : <>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
            <table className="w-full min-w-[1060px] table-fixed text-left text-sm">
              <colgroup><col className="w-[25%]" /><col className="w-[13%]" /><col className="w-[16%]" /><col className="w-[15%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[8%]" /></colgroup>
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Thuốc</th><th className="px-4 py-3">Giá / đơn vị</th><th className="px-4 py-3">Tồn kho</th><th className="px-4 py-3">Hạn sử dụng</th><th className="px-4 py-3">Cảnh báo</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-center">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrugs.map((d) => {
                  const alerts = getMedicineAlertSummary(d);
                  const expiry = getExpirySummary(d);
                  return <tr key={d.id} className="align-middle transition-colors hover:bg-slate-50/70">
                    <td className="px-4 py-3.5"><div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-600">#{d.id}</span><div className="min-w-0"><p className="break-words font-semibold leading-5 text-slate-900">{d.name}</p><p className="mt-0.5 break-words text-xs leading-4 text-slate-500">{d.activeIngredient || 'Chưa cập nhật hoạt chất'}</p></div></div></td>
                    <td className="px-4 py-3.5"><p className="whitespace-nowrap font-semibold tabular-nums text-slate-800">{Number(d.price) > 0 ? `${Number(d.price).toLocaleString('vi-VN')} ₫` : <span className="text-amber-700">Chưa cập nhật</span>}</p><p className="mt-1 break-words text-xs leading-4 text-slate-500">{d.unit_name || 'Chưa cập nhật'}</p></td>
                    <td className="px-4 py-3.5"><p className="whitespace-nowrap font-semibold tabular-nums text-slate-900">Dùng được <span className="text-teal-800">{Number(d.usable_quantity || 0)}</span></p><p className="mt-1 text-xs leading-4 text-slate-500">Tổng {Number(d.stock_quantity || 0)} · Chưa rõ {Number(d.untracked_quantity || 0)}</p><p className="text-xs leading-4 text-slate-500">Hết hạn {Number(d.expired_quantity || 0)}</p></td>
                    <td className="px-4 py-3.5"><p className={`font-medium leading-5 ${expiry.tone}`}>{expiry.label}</p><p className="mt-0.5 text-xs leading-4 text-slate-500">{expiry.detail}</p></td>
                    <td className="px-4 py-3.5">{alerts.length ? <div className="flex flex-wrap items-center gap-1.5"><span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium ${alerts[0].className}`}>{alerts[0].label}</span>{alerts.length > 1 && <span className="whitespace-nowrap text-[11px] text-slate-500">+{alerts.length - 1}</span>}</div> : <span className="text-xs text-slate-500">Bình thường</span>}{alerts.length > 1 && <p className="mt-1 text-[11px] text-slate-500">Mở lô để xem đủ cảnh báo</p>}</td>
                    <td className="px-4 py-3.5">{d.is_active ? <span className="inline-flex whitespace-nowrap rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">Đang dùng</span> : <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Đã ngừng</span>}</td>
                    <td className="px-4 py-3.5"><div className="flex items-center justify-center gap-1.5"><button type="button" title="Xem lô và lịch sử kho" aria-label={`Xem lô và lịch sử kho của ${d.name}`} onClick={() => openLots(d)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-teal-800 transition hover:bg-teal-50"><Boxes className="h-4 w-4" /></button><button type="button" title="Sửa thông tin thuốc" aria-label={`Sửa ${d.name}`} onClick={() => handleOpenEditModal(d)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"><Edit className="h-4 w-4" /></button>{d.is_active && <button type="button" disabled={pendingDeleteId === d.id} title="Ngừng sử dụng thuốc" aria-label={`Ngừng sử dụng ${d.name}`} onClick={() => handleDeleteDrug(d)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">{pendingDeleteId === d.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filteredDrugs.map((d) => {
              const alerts = getMedicineAlertSummary(d);
              const expiry = getExpirySummary(d);
              return <article key={d.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <header className="flex min-w-0 items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-600">#{d.id}</span><div className="min-w-0"><h4 className="break-words font-semibold leading-5 text-slate-900">{d.name}</h4><p className="mt-0.5 break-words text-xs leading-4 text-slate-500">{d.activeIngredient || 'Chưa cập nhật hoạt chất'}</p></div></div>{d.is_active ? <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800">Đang dùng</span> : <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">Đã ngừng</span>}</header>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-slate-100 py-3 text-sm"><div><p className="text-xs text-slate-500">Giá / đơn vị</p><p className="mt-1 break-words font-semibold tabular-nums text-slate-800">{Number(d.price) > 0 ? `${Number(d.price).toLocaleString('vi-VN')} ₫` : 'Chưa cập nhật'}</p><p className="text-xs text-slate-500">{d.unit_name || 'Chưa cập nhật'}</p></div><div><p className="text-xs text-slate-500">Tồn dùng được</p><p className="mt-1 font-semibold tabular-nums text-teal-800">{Number(d.usable_quantity || 0)}</p><p className="text-xs leading-4 text-slate-500">Tổng {Number(d.stock_quantity || 0)} · Chưa rõ {Number(d.untracked_quantity || 0)}</p></div><div><p className="text-xs text-slate-500">Hết hạn</p><p className="mt-1 font-medium tabular-nums text-slate-800">{Number(d.expired_quantity || 0)}</p></div><div><p className="text-xs text-slate-500">Hạn gần nhất</p><p className={`mt-1 font-medium ${expiry.tone}`}>{expiry.label}</p><p className="text-xs text-slate-500">{expiry.detail}</p></div></div>
                <div className="mt-3"><p className="mb-1.5 text-xs font-medium text-slate-500">Cảnh báo</p>{alerts.length ? <div className="flex flex-wrap items-center gap-1.5"><span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-medium ${alerts[0].className}`}>{alerts[0].label}</span>{alerts.length > 1 && <span className="text-xs text-slate-500">+{alerts.length - 1} cảnh báo khác</span>}</div> : <span className="text-xs text-slate-500">Bình thường</span>}</div>
                <footer className="mt-4 flex gap-2"><button type="button" title="Xem lô và lịch sử kho" aria-label={`Xem lô và lịch sử kho của ${d.name}`} onClick={() => openLots(d)} className="inline-flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-teal-800 hover:bg-teal-50"><Boxes className="h-4 w-4" /><span>Lô và tồn</span></button><button type="button" title="Sửa thông tin thuốc" aria-label={`Sửa ${d.name}`} onClick={() => handleOpenEditModal(d)} className="inline-flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100"><Edit className="h-4 w-4" /><span>Sửa</span></button>{d.is_active && <button type="button" disabled={pendingDeleteId === d.id} title="Ngừng sử dụng thuốc" aria-label={`Ngừng sử dụng ${d.name}`} onClick={() => handleDeleteDrug(d)} className="inline-flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">{pendingDeleteId === d.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}<span>Ngừng</span></button>}</footer>
              </article>;
            })}
          </div>
        </>}
      </div>}

      {activeTab === 'mealRelations' && <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-black text-slate-800 text-base">Quan hệ bữa ăn</h3><p className="mt-1 text-xs text-slate-500">Các lựa chọn đang hoạt động sẽ xuất hiện trong form kê đơn của bác sĩ.</p></div>
          <div className="relative w-full sm:w-64"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input value={relationSearch} onChange={(event) => setRelationSearch(event.target.value)} placeholder="Tìm quan hệ bữa ăn..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500" /></div>
        </div>
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead><tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100"><th className="p-3.5 w-20">Mã</th><th className="p-3.5">Lựa chọn</th><th className="p-3.5">Mô tả</th><th className="p-3.5">Trạng thái</th><th className="p-3.5 text-center">Hành động</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {mealRelationsLoading ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Đang tải quan hệ bữa ăn...</td></tr> : mealRelations.filter((item) => `${item.name} ${item.description || ''}`.toLowerCase().includes(relationSearch.toLowerCase())).length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">Chưa có lựa chọn phù hợp.</td></tr> : mealRelations.filter((item) => `${item.name} ${item.description || ''}`.toLowerCase().includes(relationSearch.toLowerCase())).map((relation) => <tr key={relation.relation_id} className="hover:bg-slate-50/60 transition">
                <td className="p-3.5 font-bold text-sky-600">#{relation.relation_id}</td><td className="p-3.5 font-bold text-slate-900">{relation.name}</td><td className="p-3.5 text-slate-600">{relation.description || 'Chưa có mô tả'}</td>
                <td className="p-3.5">{relation.is_active ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">Đang dùng</span> : <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-bold text-slate-600">Đã ngừng</span>}</td>
                <td className="p-3.5"><div className="flex items-center justify-center gap-1.5"><button title="Sửa" onClick={() => openEditMealRelation(relation)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg"><Edit className="w-3.5 h-3.5" /></button><button disabled={pendingRelationId === relation.relation_id} title={relation.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'} onClick={() => setMealRelationActive(relation)} className={`p-1.5 rounded-lg disabled:opacity-50 ${relation.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>{pendingRelationId === relation.relation_id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : relation.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}</button></div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Modal Thêm / Sửa thuốc */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                {editingDrug ? 'Chỉnh sửa thuốc' : 'Thêm thuốc mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Tên thuốc</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Paracetamol 500mg"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Hoạt chất chính</label>
                <input
                  type="text"
                  value={formData.activeIngredient}
                  onChange={(e) => setFormData({ ...formData, activeIngredient: e.target.value })}
                  placeholder="Ví dụ: Acetaminophen"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <label className="block"><span className="mb-1 block font-semibold text-slate-600">Đơn vị tính</span><select value={formData.unit_id} onChange={(event) => setFormData({ ...formData, unit_id: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5"><option value="">Chưa cập nhật</option>{units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}</select></label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Đơn giá bán (VNĐ)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Ngưỡng cảnh báo tồn thấp</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Tồn kho không chỉnh tại form này. Dùng Quản lý lô để nhập/điều chỉnh số lượng kèm hạn sử dụng và lịch sử.</p>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Quy cách đóng gói</label>
                <input
                  type="text"
                  value={formData.packing}
                  onChange={(e) => setFormData({ ...formData, packing: e.target.value })}
                  placeholder="Ví dụ: Hộp 10 vỉ x 10 viên"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Tác dụng phụ (nếu có)</label>
                <textarea
                  rows="2"
                  value={formData.sideEffect}
                  onChange={(e) => setFormData({ ...formData, sideEffect: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 shadow-sm"
                >
                  Lưu thông tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lotsDrug && <div className="fixed inset-0 z-[55] flex items-center justify-center overflow-y-auto p-3 sm:p-6">
        <button aria-label="Đóng lô thuốc" className="fixed inset-0 bg-slate-900/50" onClick={() => { setLotsDrug(null); setLotAction(null); }} />
        <section className="relative z-10 my-auto max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
            <div><h2 className="text-lg font-bold">Chi tiết thuốc và lô · {lotsDrug.name}</h2><p className="mt-1 text-xs text-slate-600">Tổng tồn vật lý {Number(lotsData?.drug?.stock_quantity ?? lotsDrug.stock_quantity ?? 0)} · tồn cũ chưa xác định lô/hạn không thể giao.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => { setLotForm({ batch_code: '', quantity: '', received_on: todayVietnam(), expires_on: '', quantity_delta: '', reason_type: 'EXPIRED', note: '' }); setLotAction('RECEIVE'); }} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white">Nhập lô mới</button>{Number(lotsData?.drug?.untracked_quantity ?? lotsDrug.untracked_quantity) > 0 && <button onClick={() => { setLotForm({ batch_code: '', quantity: '', received_on: '', expires_on: '', quantity_delta: '', reason_type: 'EXPIRED', note: '' }); setLotAction('CLASSIFY'); }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Gắn lô cho tồn cũ</button>}<button onClick={() => { setLotsDrug(null); setLotAction(null); }} className="rounded-lg border p-2"><X className="h-4 w-4" /></button></div>
          </header>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Hoạt chất</p><p className="mt-1 break-words text-sm text-slate-800">{lotsDrug.activeIngredient || 'Chưa cập nhật'}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Quy cách</p><p className="mt-1 break-words text-sm text-slate-800">{lotsDrug.packing || 'Chưa cập nhật'}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Tác dụng phụ</p><p className="mt-1 break-words text-sm text-slate-800">{lotsDrug.sideEffect || 'Chưa cập nhật'}</p></div>
          </div>
          {lotNotice && !lotAction && <p role={lotNotice.type === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-lg p-3 text-sm ${lotNotice.type === 'error' ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{lotNotice.message}</p>}
          {lotsLoading ? <p className="p-8 text-center text-sm text-slate-500">Đang tải lô và lịch sử…</p> : <>
            {lotsData?.drug && <div className="my-4 grid gap-2 text-xs sm:grid-cols-4"><div className="rounded-lg bg-emerald-50 p-3">Dùng được: <strong>{lotsData.drug.usable_quantity}</strong></div><div className="rounded-lg bg-rose-50 p-3">Hết hạn: <strong>{lotsData.drug.expired_quantity}</strong></div><div className="rounded-lg bg-slate-100 p-3">Chưa rõ lô/hạn: <strong>{lotsData.drug.untracked_quantity}</strong></div><div className="rounded-lg bg-amber-50 p-3">Ngưỡng tồn thấp: <strong>{lotsData.drug.low_stock_threshold}</strong></div></div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[780px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 font-semibold">Mã lô</th><th className="p-3 font-semibold">Nhập ngày</th><th className="p-3 font-semibold">Hết hạn</th><th className="p-3 font-semibold">Còn lại</th><th className="p-3 font-semibold">Trạng thái</th><th className="p-3 font-semibold">Người nhập</th><th className="p-3 font-semibold">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{(lotsData?.lots || []).map((lot) => <tr key={lot.batch_id} className="align-middle"><td className="p-3">{lot.batch_code || `Lô #${lot.batch_id}`}</td><td className="whitespace-nowrap p-3">{formatVietnamDate(lot.received_on)}</td><td className="whitespace-nowrap p-3">{formatVietnamDate(lot.expires_on)}</td><td className="whitespace-nowrap p-3 tabular-nums">{lot.quantity_remaining} / {lot.quantity_received}</td><td className="p-3">{lot.expiry_status === 'EXPIRED' ? 'Đã hết hạn' : lot.expiry_status.startsWith('EXPIRING') ? `Sắp hết hạn (${lot.expiry_status.slice(-2)} ngày)` : lot.expiry_status === 'EMPTY' ? 'Hết tồn' : 'Còn hạn'}</td><td className="p-3">{lot.created_by_name || 'Không còn tài khoản người nhập'}</td><td className="p-3"><div className="flex gap-1"><button disabled={!Number(lot.quantity_remaining)} onClick={() => { setLotForm({ ...lotForm, batch_id: lot.batch_id, quantity_delta: '', note: '' }); setLotAction('ADJUST'); }} className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">Điều chỉnh</button><button disabled={!Number(lot.quantity_remaining)} onClick={() => { setLotForm({ ...lotForm, batch_id: lot.batch_id, quantity: '', reason_type: lot.expiry_status === 'EXPIRED' ? 'EXPIRED' : 'DAMAGED', note: '' }); setLotAction('WRITE_OFF'); }} className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 disabled:opacity-40">Ghi hủy</button></div></td></tr>)}{!lotsData?.lots?.length && <tr><td colSpan="7" className="p-6 text-center text-slate-500">Chưa có lô đã xác định hạn sử dụng. Tồn cũ vẫn được giữ và chưa thể giao.</td></tr>}</tbody></table></div>
            <h3 className="mb-2 mt-6 font-semibold">Lịch sử kho gần đây</h3><div className="max-h-48 space-y-2 overflow-y-auto">{(lotsData?.movements || []).map((movement) => <div key={movement.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs"><span>{movement.created_at} · {movement.reason} · {movement.note || 'Không có ghi chú'} · {movement.performed_by_name || 'Không rõ người thao tác'}</span><strong className={Number(movement.quantity_delta) > 0 ? 'text-emerald-700' : 'text-rose-700'}>{Number(movement.quantity_delta) > 0 ? '+' : ''}{movement.quantity_delta}</strong></div>)}{!lotsData?.movements?.length && <p className="text-xs text-slate-500">Chưa có lịch sử kho được ghi nhận.</p>}</div>
          </>}
        </section>
      </div>}

      {lotAction && lotsDrug && <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
        <form onSubmit={submitLotAction} className="my-auto w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <h2 className="text-lg font-bold">{lotAction === 'RECEIVE' ? 'Nhập thuốc theo lô' : lotAction === 'CLASSIFY' ? 'Gắn lô cho tồn cũ đã xác minh' : lotAction === 'ADJUST' ? 'Điều chỉnh số lượng lô' : 'Ghi nhận hủy thuốc'}</h2>
          {lotNotice?.type === 'error' && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{lotNotice.message}</p>}
          <p className="text-sm text-slate-600">{lotsDrug.name}{lotForm.batch_id ? ` · Lô #${lotForm.batch_id}` : ''}</p>
          {lotAction === 'RECEIVE' || lotAction === 'CLASSIFY' ? <>
            {lotAction === 'CLASSIFY' && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Chỉ nhập số lượng và hạn dùng đã đối chiếu chứng từ/bao bì thật. Không xác định được hạn thì để tồn ở trạng thái chưa rõ; tổng tồn không bị cộng thêm.</p>}
            <label className="block text-sm">Số lượng nhập *<input required min="1" step="1" type="number" value={lotForm.quantity} onChange={(event) => setLotForm({ ...lotForm, quantity: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="block text-sm">Ngày nhập *<input required type="date" max={todayVietnam()} value={lotForm.received_on} onChange={(event) => setLotForm({ ...lotForm, received_on: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="block text-sm">Ngày hết hạn *<input required type="date" min={lotAction === 'RECEIVE' ? todayVietnam() : undefined} value={lotForm.expires_on} onChange={(event) => setLotForm({ ...lotForm, expires_on: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
            <label className="block text-sm">Mã lô (nếu có)<input maxLength={100} value={lotForm.batch_code} onChange={(event) => setLotForm({ ...lotForm, batch_code: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
          </> : <>
            {lotAction === 'ADJUST' ? <label className="block text-sm">Điều chỉnh số lượng *<input required type="number" step="1" value={lotForm.quantity_delta} onChange={(event) => setLotForm({ ...lotForm, quantity_delta: event.target.value })} placeholder="Số dương tăng, số âm giảm" className="mt-1 w-full rounded-lg border p-2" /></label> : <><label className="block text-sm">Số lượng hủy *<input required min="1" step="1" type="number" value={lotForm.quantity} onChange={(event) => setLotForm({ ...lotForm, quantity: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">Lý do<select value={lotForm.reason_type} onChange={(event) => setLotForm({ ...lotForm, reason_type: event.target.value })} className="mt-1 w-full rounded-lg border p-2"><option value="EXPIRED">Hết hạn</option><option value="DAMAGED">Hư hỏng</option></select></label></>}
          </>}
          <label className="block text-sm">Lý do/ghi chú *<textarea required maxLength={255} value={lotForm.note} onChange={(event) => setLotForm({ ...lotForm, note: event.target.value })} className="mt-1 w-full rounded-lg border p-2" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setLotAction(null)} className="rounded-lg border px-3 py-2 text-sm">Hủy</button><button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Lưu lịch sử kho</button></div>
        </form>
      </div>}

      {isMealRelationModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMealRelationModalOpen(false)} />
        <div className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3"><div><h3 className="text-base font-black text-slate-800">{editingMealRelation ? 'Sửa quan hệ bữa ăn' : 'Thêm quan hệ bữa ăn'}</h3><p className="mt-1 text-xs text-slate-500">Không cần tạo danh mục thời điểm uống thuốc.</p></div><button onClick={() => setIsMealRelationModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button></div>
          <form onSubmit={saveMealRelation} className="space-y-3 text-xs">
            <label className="block"><span className="mb-1 block font-semibold text-slate-600">* Tên lựa chọn</span><input required maxLength={50} value={mealRelationForm.name} onChange={(event) => setMealRelationForm({ ...mealRelationForm, name: event.target.value })} placeholder="Ví dụ: Trước ăn" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5" /></label>
            <label className="block"><span className="mb-1 block font-semibold text-slate-600">Mô tả</span><textarea maxLength={255} rows={3} value={mealRelationForm.description} onChange={(event) => setMealRelationForm({ ...mealRelationForm, description: event.target.value })} placeholder="Hướng dẫn ngắn về quan hệ với bữa ăn" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5" /></label>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setIsMealRelationModalOpen(false)} className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-600 hover:bg-slate-200">Hủy</button><button type="submit" className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"><Save className="h-3.5 w-3.5" />Lưu lựa chọn</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
};

export default MedicineMgmt;

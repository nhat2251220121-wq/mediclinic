import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Plus, Search, Edit, CircleOff, CircleCheck, X, RefreshCw } from 'lucide-react';
import DoctorCountDetailsButton from './DoctorCountDetailsButton';

const isSpecialtyActive = (specialty) => specialty.is_active === true || Number(specialty.is_active) === 1;

const SpecialtyMgmt = () => {
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [pendingStatusId, setPendingStatusId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [descriptionItem, setDescriptionItem] = useState(null);

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axiosClient.get('/admin/specialties');
      if (res.success) setSpecialties(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách chuyên khoa:', err);
      setActionNotice({ type: 'error', message: err.message || 'Không tải được danh sách chuyên khoa.' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ name: '', description: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ name: item.name || '', description: item.description || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axiosClient.put(`/admin/specialties/${editingItem.id}`, formData);
      } else {
        await axiosClient.post('/admin/specialties', formData);
      }
      setIsModalOpen(false);
      await fetchSpecialties({ showLoading: false });
      setActionNotice({ type: 'success', message: editingItem ? 'Đã cập nhật chuyên khoa.' : 'Đã thêm chuyên khoa.' });
    } catch (err) {
      alert('Lỗi lưu chuyên khoa: ' + (err.message || 'Lỗi server'));
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Ngừng sử dụng chuyên khoa “${item.name}”? Dịch vụ, hồ sơ bác sĩ và lịch sử khám hiện có được giữ nguyên.`)) return;
    setPendingStatusId(item.id); setActionNotice(null);
    try {
      const result = await axiosClient.delete(`/admin/specialties/${item.id}`);
      setSpecialties((current) => current.map((specialty) => specialty.id === item.id ? { ...specialty, is_active: false } : specialty));
      setActionNotice({ type: 'success', message: result.message || `Đã ngừng chuyên khoa “${item.name}”.` });
      await fetchSpecialties({ showLoading: false });
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không ngừng được chuyên khoa. Dữ liệu hiện có chưa bị xóa.' });
    } finally { setPendingStatusId(null); }
  };

  const handleReactivate = async (item) => {
    if (!window.confirm(`Kích hoạt lại chuyên khoa “${item.name}”? Chuyên khoa sẽ được phép chọn cho dịch vụ và lịch đặt mới.`)) return;
    setPendingStatusId(item.id); setActionNotice(null);
    try {
      const result = await axiosClient.put(`/admin/specialties/${item.id}`, { name: item.name, description: item.description || '', is_active: true });
      setSpecialties((current) => current.map((specialty) => specialty.id === item.id ? { ...specialty, is_active: true } : specialty));
      setActionNotice({ type: 'success', message: result.message || `Đã kích hoạt lại chuyên khoa “${item.name}”.` });
      await fetchSpecialties({ showLoading: false });
    } catch (err) { setActionNotice({ type: 'error', message: err.message || 'Không kích hoạt lại được chuyên khoa.' }); }
    finally { setPendingStatusId(null); }
  };

  const activeSpecialties = specialties.filter(isSpecialtyActive);
  const inactiveSpecialties = specialties.filter((specialty) => !isSpecialtyActive(specialty));
  const query = searchTerm.trim().toLocaleLowerCase('vi');
  const visibleSpecialties = (activeTab === 'ACTIVE' ? activeSpecialties : inactiveSpecialties).filter((specialty) =>
    `${specialty.name || ''} ${specialty.description || ''}`.toLocaleLowerCase('vi').includes(query)
  );

  const renderDescription = (item) => {
    const description = item.description?.trim();
    if (!description) return <span className="text-slate-400">Chưa cập nhật</span>;
    return <div className="min-w-0"><p title={description} className="line-clamp-2 break-words leading-5 text-slate-600">{description}</p>{description.length > 70 && <button type="button" onClick={() => setDescriptionItem(item)} className="mt-1 text-xs font-medium text-teal-800 underline decoration-teal-300 underline-offset-2 hover:text-teal-950">Xem đầy đủ</button>}</div>;
  };

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Chuyên Khoa Khám Bệnh</h2>
          <p className="text-sm text-slate-500 mt-1">Danh mục chuyên khoa nội, ngoại, da liễu, răng hàm mặt...</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSpecialties()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4 text-sky-600" />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm mới chuyên khoa</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách chuyên khoa</h3>
          <div className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm chuyên khoa..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          <button type="button" onClick={() => setActiveTab('ACTIVE')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:px-4 ${activeTab === 'ACTIVE' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đang hoạt động <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 tabular-nums text-teal-800">{activeSpecialties.length}</span>
          </button>
          <button type="button" onClick={() => setActiveTab('INACTIVE')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:px-4 ${activeTab === 'INACTIVE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đã ngừng <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 tabular-nums text-slate-700">{inactiveSpecialties.length}</span>
          </button>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 px-4 py-12 text-center text-sm text-slate-500">Đang tải danh sách chuyên khoa...</div> : visibleSpecialties.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">{query ? 'Không tìm thấy chuyên khoa phù hợp trong tab này.' : activeTab === 'ACTIVE' ? 'Chưa có chuyên khoa đang hoạt động.' : 'Chưa có chuyên khoa đã ngừng.'}</div> : <>
          <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
            <table className="w-full min-w-[960px] table-fixed text-left text-sm">
              <colgroup><col className="w-[8%]" /><col className="w-[24%]" /><col className="w-[34%]" /><col className="w-[14%]" /><col className="w-[11%]" /><col className="w-[9%]" /></colgroup>
              <thead><tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><th className="whitespace-nowrap px-4 py-3">Mã</th><th className="whitespace-nowrap px-4 py-3">Chuyên khoa</th><th className="px-4 py-3">Mô tả</th><th className="whitespace-nowrap px-4 py-3 text-center">Số bác sĩ</th><th className="whitespace-nowrap px-4 py-3">Trạng thái</th><th className="whitespace-nowrap px-4 py-3 text-center">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSpecialties.map((item) => <tr key={item.id} className="h-[84px] align-middle transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-600">#{item.id}</td>
                  <td className="px-4 py-3"><p className="break-words font-semibold leading-5 text-slate-900">{item.name}</p></td>
                  <td className="px-4 py-3">{renderDescription(item)}</td>
                  <td className="px-4 py-3"><div className="flex items-center justify-center gap-2"><span className="inline-flex min-w-9 justify-center rounded-lg bg-slate-100 px-2 py-1 font-semibold tabular-nums text-slate-700">{Number(item.doctor_count) || 0}</span><DoctorCountDetailsButton item={item} relation="specialty" /></div></td>
                  <td className="px-4 py-3">{isSpecialtyActive(item) ? <span className="inline-flex whitespace-nowrap rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">Đang hoạt động</span> : <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Đã ngừng</span>}</td>
                  <td className="px-4 py-3"><div className="flex items-center justify-center gap-1.5"><button type="button" title="Sửa chuyên khoa" aria-label={`Sửa ${item.name}`} onClick={() => handleOpenEdit(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"><Edit className="h-4 w-4" /></button>{isSpecialtyActive(item) ? <button type="button" disabled={pendingStatusId === item.id} title="Ngừng hoạt động (giữ dữ liệu liên quan)" aria-label={`Ngừng hoạt động ${item.name}`} onClick={() => handleDelete(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">{pendingStatusId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CircleOff className="h-4 w-4" />}</button> : <button type="button" disabled={pendingStatusId === item.id} title="Kích hoạt lại chuyên khoa" aria-label={`Kích hoạt lại ${item.name}`} onClick={() => handleReactivate(item)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 text-teal-900 transition hover:bg-teal-100 disabled:opacity-50">{pendingStatusId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CircleCheck className="h-4 w-4" />}</button>}</div></td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {visibleSpecialties.map((item) => <article key={item.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex min-w-0 items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2.5"><span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-600">#{item.id}</span><h4 className="break-words font-semibold leading-5 text-slate-900">{item.name}</h4></div>{isSpecialtyActive(item) ? <span className="shrink-0 whitespace-nowrap rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-800">Đang hoạt động</span> : <span className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">Đã ngừng</span>}</header>
              <div className="mt-3">{renderDescription(item)}</div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><div><p className="text-[11px] text-slate-500">Số bác sĩ đang hoạt động</p><div className="mt-1 flex items-center gap-1"><span className="inline-flex min-w-9 justify-center rounded-lg bg-slate-100 px-2 py-1 text-sm font-semibold tabular-nums text-slate-700">{Number(item.doctor_count) || 0}</span><DoctorCountDetailsButton item={item} relation="specialty" /></div></div><div className="flex gap-2"><button type="button" onClick={() => handleOpenEdit(item)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700"><Edit className="h-3.5 w-3.5" />Sửa</button>{isSpecialtyActive(item) ? <button type="button" disabled={pendingStatusId === item.id} onClick={() => handleDelete(item)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 disabled:opacity-50">{pendingStatusId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CircleOff className="h-3.5 w-3.5" />}Ngừng</button> : <button type="button" disabled={pendingStatusId === item.id} onClick={() => handleReactivate(item)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-900 disabled:opacity-50">{pendingStatusId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}Kích hoạt</button>}</div></div>
            </article>)}
          </div>
        </>}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                {editingItem ? 'Chỉnh sửa chuyên khoa' : 'Thêm chuyên khoa mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Tên chuyên khoa</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Chuyên khoa Nội tổng quát"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Mô tả chuyên khoa</label>
                <textarea
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
                  Lưu dữ liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {descriptionItem && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="specialty-description-title"><button type="button" className="fixed inset-0 bg-slate-950/50" onClick={() => setDescriptionItem(null)} aria-label="Đóng mô tả" /><section className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><header className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-teal-800">Chuyên khoa #{descriptionItem.id}</p><h3 id="specialty-description-title" className="mt-1 break-words text-lg font-semibold text-slate-900">{descriptionItem.name}</h3></div><button type="button" onClick={() => setDescriptionItem(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button></header><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{descriptionItem.description || 'Chưa cập nhật mô tả.'}</p></section></div>}
    </div>
  );
};

export default SpecialtyMgmt;

import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Stethoscope, Plus, Search, Edit, Trash2, Archive, X, RefreshCw } from 'lucide-react';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import DoctorCountDetailsButton from './DoctorCountDetailsButton';

const isActive = (value) => value === true || Number(value) === 1;

const ServiceMgmt = () => {
  const [services, setServices] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ACTIVE');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: 300000, description: '', image_url: '', specialty_id: '' });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [specialtyError, setSpecialtyError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [descriptionItem, setDescriptionItem] = useState(null);

  useEffect(() => {
    fetchServices();
    axiosClient.get('/admin/specialties')
      .then((res) => setSpecialties(res.data || []))
      .catch(() => setSpecialtyError('Không tải được danh sách chuyên khoa.'));
  }, []);

  const fetchServices = async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axiosClient.get('/admin/services');
      if (res.success) setServices(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách dịch vụ:', err);
      setActionNotice({ type: 'error', message: err.message || 'Không tải được danh sách dịch vụ.' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ name: '', price: 300000, description: '', image_url: '', specialty_id: '' });
    setImageFile(null); setPreviewUrl(''); setRemoveImage(false); setSaveError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      price: item.price || 300000,
      description: item.description || '',
      image_url: item.image_url || '',
      specialty_id: item.specialty_id ? String(item.specialty_id) : ''
    });
    setImageFile(null); setPreviewUrl(item.image_url || ''); setRemoveImage(false); setSaveError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    setIsSaving(true);
    try {
      let serviceId = editingItem?.id;
      if (editingItem) {
        await axiosClient.put(`/admin/services/${editingItem.id}`, formData);
      } else {
        const created = await axiosClient.post('/admin/services', formData);
        serviceId = created.id;
        setEditingItem({ id: serviceId, ...formData });
      }
      if (imageFile) {
        const data = new FormData(); data.append('image', imageFile);
        await axiosClient.post(`/admin/services/${serviceId}/image`, data);
      } else if (removeImage && editingItem?.image_url) {
        const result = await axiosClient.delete(`/admin/services/${serviceId}/image`);
        setActionNotice({ type: result.cleanupWarning ? 'error' : 'success', message: result.message || 'Đã bỏ ảnh dịch vụ.' });
      }
      setIsModalOpen(false);
      await fetchServices({ showLoading: false });
      setActionNotice({ type: 'success', message: editingItem ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.' });
    } catch (err) {
      setSaveError(err.message || 'Không lưu được dịch vụ hoặc ảnh. Ảnh cũ vẫn được giữ nếu upload thất bại.');
      await fetchServices({ showLoading: false });
    } finally { setIsSaving(false); }
  };

  const selectImage = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSaveError('Ảnh không được vượt quá 5 MB.'); return; }
    setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); setRemoveImage(false); setSaveError('');
  };

  const handleDelete = async (item) => {
    const hasHistory = Number(item.appointment_count) > 0 || Number(item.invoice_count) > 0;
    const confirmation = hasHistory
      ? `Lưu trữ dịch vụ “${item.name}”? Dịch vụ có ${Number(item.appointment_count) || 0} lịch sử khám và ${Number(item.invoice_count) || 0} hóa đơn tham chiếu. Dữ liệu lịch sử sẽ được giữ và dịch vụ không còn dùng để đặt mới.`
      : `Xóa hẳn dịch vụ “${item.name}”? Backend sẽ kiểm tra lại tham chiếu trước khi xóa. Chỉ dịch vụ không có lịch hẹn hoặc hóa đơn mới bị xóa khỏi database.`;
    if (!window.confirm(confirmation)) return;
    setPendingDeleteId(item.id); setActionNotice(null);
    try {
      const result = await axiosClient.delete(`/admin/services/${item.id}`);
      if (result.action === 'deleted') setServices((current) => current.filter((service) => service.id !== item.id));
      else setServices((current) => current.map((service) => service.id === item.id ? { ...service, is_active: false } : service));
      await fetchServices({ showLoading: false });
      setActionNotice({ type: 'success', message: result.message || (result.action === 'deleted' ? `Đã xóa dịch vụ “${item.name}”.` : `Đã lưu trữ dịch vụ “${item.name}”.`) });
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không thể xóa hoặc lưu trữ dịch vụ. Dữ liệu hiện có chưa bị thay đổi.' });
    } finally { setPendingDeleteId(null); }
  };

  const activeServices = services.filter((service) => isActive(service.is_active));
  const archivedServices = services.filter((service) => !isActive(service.is_active));
  const currentServices = activeTab === 'ACTIVE' ? activeServices : archivedServices;
  const query = searchTerm.trim().toLocaleLowerCase('vi');
  const filtered = currentServices.filter((service) => `${service.name || ''} ${service.specialty_name || ''}`.toLocaleLowerCase('vi').includes(query));
  const renderDescription = (item) => {
    const description = item.description?.trim();
    if (!description) return <span className="text-slate-400">Chưa cập nhật</span>;
    return <div className="min-w-0">
      <p title={description} className="truncate text-slate-600">{description}</p>
      {description.length > 60 && <button type="button" onClick={() => setDescriptionItem(item)} className="mt-1 text-[11px] font-medium text-teal-800 underline underline-offset-2">Xem đầy đủ</button>}
    </div>;
  };

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Gói Dịch Vụ Khám</h2>
          <p className="text-sm text-slate-500 mt-1">Danh mục gói dịch vụ y tế, giá tiền và thông tin chi tiết.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchServices}
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
            <span>+ Thêm mới dịch vụ</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách gói dịch vụ</h3>
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm dịch vụ..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          <button type="button" onClick={() => setActiveTab('ACTIVE')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${activeTab === 'ACTIVE' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đang sử dụng <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 tabular-nums text-teal-800">{activeServices.length}</span>
          </button>
          <button type="button" onClick={() => setActiveTab('ARCHIVED')} className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${activeTab === 'ARCHIVED' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đã lưu trữ <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 tabular-nums text-slate-700">{archivedServices.length}</span>
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full min-w-[1120px] table-fixed text-left text-xs">
            <colgroup><col className="w-[6%]" /><col className="w-[17%]" /><col className="w-[16%]" /><col className="w-[9%]" /><col className="w-[8%]" /><col className="w-[11%]" /><col className="w-[23%]" /><col className="w-[10%]" /></colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="whitespace-nowrap p-3">Mã</th>
                <th className="whitespace-nowrap p-3">Tên dịch vụ</th>
                <th className="whitespace-nowrap p-3">Chuyên khoa</th>
                <th className="p-3 text-center leading-4">Số bác sĩ</th>
                <th className="whitespace-nowrap p-3 text-center">Ảnh</th>
                <th className="whitespace-nowrap p-3 text-right">Giá</th>
                <th className="whitespace-nowrap p-3">Mô tả</th>
                <th className="whitespace-nowrap p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Đang tải gói dịch vụ...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">{query ? 'Không tìm thấy dịch vụ trong mục này.' : activeTab === 'ACTIVE' ? 'Không có dịch vụ đang sử dụng.' : 'Chưa có dịch vụ đã lưu trữ.'}</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="h-[76px] transition hover:bg-slate-50/60">
                    <td className="whitespace-nowrap p-3 font-bold tabular-nums text-sky-700">#{item.id}</td>
                    <td className="p-3"><p title={item.name} className="truncate font-semibold text-slate-900">{item.name}</p></td>
                    <td className="p-3">
                      {item.specialty_id ? <div className="min-w-0">
                        <p title={item.specialty_name || ''} className="truncate font-medium text-slate-700">{item.specialty_name || `Chuyên khoa #${item.specialty_id}`}</p>
                        {item.specialty_is_active !== undefined && !isActive(item.specialty_is_active) && <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">Khoa đã ngừng</span>}
                      </div> : <span className="text-amber-800">Chưa gán chuyên khoa</span>}
                    </td>
                    <td className="p-2 text-center"><div className="flex flex-col items-center justify-center gap-0.5"><span className="font-semibold tabular-nums text-slate-700">{Number(item.doctor_count) || 0}</span><span className="text-[10px] text-slate-500">Theo khoa</span><DoctorCountDetailsButton item={item} relation="service" /></div></td>
                    <td className="p-3"><div className="flex justify-center"><ImageWithFallback src={item.image_url} alt={item.name} className="h-11 w-14 rounded-lg object-cover" fallback={<Stethoscope className="h-5 w-5" />} /></div></td>
                    <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums text-emerald-800">{Number(item.price).toLocaleString('vi-VN')} ₫</td>
                    <td className="p-3">{renderDescription(item)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isActive(item.is_active) ? <>
                          <button type="button" title="Sửa dịch vụ" aria-label={`Sửa ${item.name}`} onClick={() => handleOpenEdit(item)} className="rounded-lg p-2 text-sky-700 hover:bg-sky-50">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" disabled={pendingDeleteId === item.id} title={Number(item.appointment_count) || Number(item.invoice_count) ? 'Lưu trữ dịch vụ có dữ liệu lịch sử' : 'Xóa dịch vụ chưa được sử dụng'} aria-label={`${Number(item.appointment_count) || Number(item.invoice_count) ? 'Lưu trữ' : 'Xóa'} ${item.name}`} onClick={() => handleDelete(item)} className="rounded-lg p-2 text-slate-600 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">
                            {pendingDeleteId === item.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : Number(item.appointment_count) || Number(item.invoice_count) ? <Archive className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </> : Number(item.appointment_count) || Number(item.invoice_count) ? <span className="whitespace-nowrap text-[10px] text-slate-500">Đang giữ lịch sử</span> : <button type="button" disabled={pendingDeleteId === item.id} title="Xóa hẳn dịch vụ lưu trữ không có dữ liệu tham chiếu" aria-label={`Xóa hẳn ${item.name}`} onClick={() => handleDelete(item)} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                          {pendingDeleteId === item.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                {editingItem ? 'Chỉnh sửa gói dịch vụ' : 'Thêm gói dịch vụ mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {saveError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-rose-700">{saveError}</p>}
              <div className="space-y-2">
                <label className="font-semibold text-slate-600 block">Ảnh dịch vụ (JPEG, PNG, WebP · tối đa 5 MB)</label>
                <ImageWithFallback src={previewUrl} alt="Xem trước ảnh dịch vụ" className="h-32 w-full rounded-xl object-cover" fallback={<Stethoscope className="h-8 w-8" />} />
                <div className="flex flex-wrap gap-2">
                  <label className="cursor-pointer rounded-lg border px-3 py-2 font-semibold hover:bg-slate-50">{previewUrl ? 'Thay ảnh' : 'Chọn ảnh từ máy'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => selectImage(e.target.files?.[0])} /></label>
                  {previewUrl && <button type="button" onClick={() => { if (editingItem?.image_url && !window.confirm(`Gỡ ảnh của dịch vụ “${editingItem.name}”? Thao tác chỉ hoàn tất khi lưu biểu mẫu.`)) return; setImageFile(null); setPreviewUrl(''); setRemoveImage(true); }} className="rounded-lg border px-3 py-2 text-rose-700">Bỏ ảnh</button>}
                  {removeImage && editingItem?.image_url && <button type="button" onClick={() => { setRemoveImage(false); setPreviewUrl(editingItem.image_url); }} className="rounded-lg border px-3 py-2">Giữ ảnh cũ</button>}
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Tên dịch vụ khám</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Khám Nội tổng quát"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label htmlFor="service-specialty" className="font-semibold text-slate-600 block mb-1">* Chuyên khoa</label>
                <select id="service-specialty" required value={formData.specialty_id}
                  onChange={(e) => setFormData({ ...formData, specialty_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <option value="">Chọn chuyên khoa</option>
                  {specialties.some((specialty) => String(specialty.id) === formData.specialty_id && !isActive(specialty.is_active)) && <option value={formData.specialty_id} disabled>{specialties.find((specialty) => String(specialty.id) === formData.specialty_id)?.name} (đã ngừng)</option>}
                  {specialties.filter((specialty) => isActive(specialty.is_active)).map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
                </select>
                {specialtyError && <p role="alert" className="mt-1 text-rose-700">{specialtyError}</p>}
                {!specialtyError && !specialties.some((specialty) => isActive(specialty.is_active)) && <p className="mt-1 text-amber-700">Chưa có chuyên khoa đang hoạt động để gán.</p>}
                {editingItem && (!formData.specialty_id || (specialties.some((specialty) => String(specialty.id) === formData.specialty_id && !isActive(specialty.is_active)))) && <p className="mt-1 text-amber-800">Chuyên khoa đang gắn với dịch vụ đã ngừng hoạt động. Hãy chọn chuyên khoa đang hoạt động hoặc ngừng cung cấp dịch vụ. Lịch mới hiện bị backend từ chối.</p>}
              </div>

              {editingItem && <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><span className="font-semibold text-slate-600">Trạng thái dịch vụ: </span><span className={isActive(editingItem.is_active) ? 'font-semibold text-emerald-800' : 'font-semibold text-slate-600'}>{isActive(editingItem.is_active) ? 'Đang cung cấp' : 'Đã ngừng'}</span><p className="mt-1 text-[11px] text-slate-500">Dùng thao tác ở danh sách để ngừng cung cấp; trạng thái và dữ liệu lịch sử được giữ riêng.</p></div>}

              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Giá dịch vụ (VNĐ)</label>
                <input
                  type="number"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Mô tả dịch vụ</label>
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
                  disabled={isSaving}
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 shadow-sm disabled:opacity-60"
                >
                  {isSaving ? 'Đang lưu…' : 'Lưu dịch vụ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {descriptionItem && <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="service-description-title"><button type="button" className="fixed inset-0 bg-slate-950/50" onClick={() => setDescriptionItem(null)} aria-label="Đóng mô tả" /><section className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"><header className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-teal-800">Dịch vụ #{descriptionItem.id}</p><h3 id="service-description-title" className="mt-1 break-words text-lg font-semibold text-slate-900">{descriptionItem.name}</h3></div><button type="button" onClick={() => setDescriptionItem(null)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Đóng"><X className="h-5 w-5" /></button></header><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{descriptionItem.description || 'Chưa cập nhật mô tả.'}</p></section></div>}
    </div>
  );
};

export default ServiceMgmt;

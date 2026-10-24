import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Stethoscope, Plus, Search, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import DoctorCountDetailsButton from './DoctorCountDetailsButton';

const ServiceMgmt = () => {
  const [services, setServices] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: 300000, description: '', image_url: '', specialty_id: '' });
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [specialtyError, setSpecialtyError] = useState('');

  useEffect(() => {
    fetchServices();
    axiosClient.get('/admin/specialties')
      .then((res) => setSpecialties((res.data || []).filter((specialty) => specialty.is_active)))
      .catch(() => setSpecialtyError('Không tải được danh sách chuyên khoa.'));
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/services');
      if (res.success) setServices(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách dịch vụ:', err);
    } finally {
      setLoading(false);
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
        await axiosClient.delete(`/admin/services/${serviceId}/image`);
      }
      setIsModalOpen(false); fetchServices();
    } catch (err) {
      setSaveError(err.message || 'Không lưu được dịch vụ hoặc ảnh. Ảnh cũ vẫn được giữ nếu upload thất bại.');
      fetchServices();
    }
  };

  const selectImage = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setSaveError('Ảnh không được vượt quá 5 MB.'); return; }
    setImageFile(file); setPreviewUrl(URL.createObjectURL(file)); setRemoveImage(false); setSaveError('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa dịch vụ khám này?')) return;
    try {
      await axiosClient.delete(`/admin/services/${id}`);
      fetchServices();
    } catch (err) {
      alert('Lỗi xóa dịch vụ: ' + (err.message || 'Lỗi server'));
    }
  };

  const filtered = services.filter(s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 font-sans">
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
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách gói dịch vụ</h3>
          <div className="relative w-64">
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

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="p-3.5 w-16">Mã</th>
                <th className="p-3.5">Tên dịch vụ</th>
                <th className="p-3.5">Chuyên khoa</th>
                <th className="p-3.5 text-center w-36">Số lượng bác sĩ</th>
                <th className="p-3.5">Ảnh</th>
                <th className="p-3.5">Giá tiền</th>
                <th className="p-3.5">Mô tả ngắn</th>
                <th className="p-3.5 text-center w-28">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Đang tải gói dịch vụ...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-slate-400">Chưa có dữ liệu gói dịch vụ.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-sky-600">#{item.id}</td>
                    <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                    <td className="p-3.5 text-slate-600">{item.specialty_name || specialties.find((sp) => Number(sp.id) === Number(item.specialty_id))?.name || 'Chưa gán chuyên khoa'}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700"><span>{Number(item.doctor_count) || 0}</span><span className="block text-[10px] font-normal text-slate-500">Theo chuyên khoa</span><DoctorCountDetailsButton item={item} relation="service" /></td>
                    <td className="p-3.5"><ImageWithFallback src={item.image_url} alt={item.name} className="h-12 w-16 rounded-lg object-cover" fallback={<Stethoscope className="h-5 w-5" />} /></td>
                    <td className="p-3.5 font-extrabold text-emerald-600">{Number(item.price).toLocaleString()} đ</td>
                    <td className="p-3.5 text-slate-600 max-w-xs truncate">{item.description || 'Chưa cập nhật'}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
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
                  {previewUrl && <button type="button" onClick={() => { setImageFile(null); setPreviewUrl(''); setRemoveImage(true); }} className="rounded-lg border px-3 py-2 text-rose-700">Bỏ ảnh</button>}
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
                  {specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}
                </select>
                {specialtyError && <p role="alert" className="mt-1 text-rose-700">{specialtyError}</p>}
                {!specialtyError && !specialties.length && <p className="mt-1 text-amber-700">Chưa có chuyên khoa đang hoạt động để gán.</p>}
                {!formData.specialty_id && editingItem && <p className="mt-1 text-amber-700">Dịch vụ này chưa được gán khoa; hãy chọn đúng chuyên khoa trước khi lưu để cho phép đặt lịch.</p>}
              </div>

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
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 shadow-sm"
                >
                  Lưu dịch vụ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceMgmt;

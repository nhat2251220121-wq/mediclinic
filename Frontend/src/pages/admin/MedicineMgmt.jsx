import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Pill, Plus, Search, Edit, Trash2, X, RefreshCw, Save, Check } from 'lucide-react';

const MedicineMgmt = () => {
  const [activeTab, setActiveTab] = useState('drugs');
  const [drugs, setDrugs] = useState([]);
  const [mealRelations, setMealRelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mealRelationsLoading, setMealRelationsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [relationSearch, setRelationSearch] = useState('');

  // Modal State cho Thêm / Sửa thuốc
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    activeIngredient: '',
    packing: '',
    sideEffect: '',
    price: 5000,
    stock_quantity: 100
  });
  const [isMealRelationModalOpen, setIsMealRelationModalOpen] = useState(false);
  const [editingMealRelation, setEditingMealRelation] = useState(null);
  const [mealRelationForm, setMealRelationForm] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchMedicines();
    fetchMealRelations();
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
      alert('Không tải được danh sách quan hệ bữa ăn: ' + (err.message || 'Lỗi server'));
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
    try {
      if (active) await axiosClient.delete(`/admin/meal-relations/${relation.relation_id}`);
      else await axiosClient.put(`/admin/meal-relations/${relation.relation_id}`, { ...relation, is_active: true });
      await fetchMealRelations();
    } catch (err) {
      alert('Lỗi cập nhật quan hệ bữa ăn: ' + (err.message || 'Lỗi server'));
    }
  };

  const handleOpenCreateModal = () => {
    setEditingDrug(null);
    setFormData({
      name: '',
      activeIngredient: '',
      packing: 'Hộp 10 vỉ x 10 viên',
      sideEffect: '',
      price: 5000,
      stock_quantity: 100
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
      price: drug.price || 0,
      stock_quantity: drug.stock_quantity || 100
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    try {
      if (editingDrug) {
        await axiosClient.put(`/admin/medicines/${editingDrug.id}`, formData);
      } else {
        await axiosClient.post('/admin/medicines', formData);
      }
      setIsModalOpen(false);
      fetchMedicines();
    } catch (err) {
      alert('Lỗi lưu thuốc: ' + (err.message || 'Lỗi server'));
    }
  };

  const handleDeleteDrug = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thuốc này?')) return;
    try {
      await axiosClient.delete(`/admin/medicines/${id}`);
      fetchMedicines();
    } catch (err) {
      alert('Lỗi xóa thuốc: ' + (err.message || 'Lỗi server'));
    }
  };

  const filteredDrugs = drugs.filter(d =>
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.activeIngredient?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
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
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách dược phẩm phòng khám</h3>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm tên thuốc hoặc hoạt chất..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="p-3.5">Mã</th>
                <th className="p-3.5">Tên thuốc</th>
                <th className="p-3.5">Hoạt chất</th>
                <th className="p-3.5">Đơn giá</th>
                <th className="p-3.5">Quy cách</th>
                <th className="p-3.5">Tác dụng phụ</th>
                <th className="p-3.5 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải danh sách thuốc...</td>
                </tr>
              ) : filteredDrugs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Chưa có dữ liệu thuốc.</td>
                </tr>
              ) : (
                filteredDrugs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-sky-600">#{d.id}</td>
                    <td className="p-3.5 font-bold text-slate-900">{d.name}</td>
                    <td className="p-3.5 text-slate-600 italic">{d.activeIngredient || 'Chưa cập nhật'}</td>
                    <td className="p-3.5 font-extrabold text-emerald-600">{Number(d.price || 0).toLocaleString()}đ</td>
                    <td className="p-3.5 text-slate-700">{d.packing || 'Hộp'}</td>
                    <td className="p-3.5 text-rose-600">{d.sideEffect || 'Không đáng kể'}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(d)}
                          className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDrug(d.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
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
                <td className="p-3.5"><div className="flex items-center justify-center gap-1.5"><button title="Sửa" onClick={() => openEditMealRelation(relation)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg"><Edit className="w-3.5 h-3.5" /></button><button title={relation.is_active ? 'Ngừng sử dụng' : 'Kích hoạt lại'} onClick={() => setMealRelationActive(relation)} className={`p-1.5 rounded-lg ${relation.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}>{relation.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}</button></div></td>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Đơn giá (VNĐ)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Số lượng tồn kho</label>
                  <input
                    type="number"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

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

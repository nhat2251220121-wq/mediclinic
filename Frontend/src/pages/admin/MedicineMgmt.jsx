import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Pill, Plus, Search, Filter, Edit, Trash2, Clock, Utensils, X, RefreshCw, Loader2, Save } from 'lucide-react';

const MedicineMgmt = () => {
  const [activeTab, setActiveTab] = useState('drugs');
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  useEffect(() => {
    fetchMedicines();
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
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMedicines}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            <span>Làm mới</span>
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Thêm mới thuốc</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
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
      </div>

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
    </div>
  );
};

export default MedicineMgmt;

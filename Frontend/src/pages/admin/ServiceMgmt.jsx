import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, Upload, Stethoscope, Image } from 'lucide-react';

const mockServices = [
  {
    id: 1,
    name: 'Khám da liễu',
    price: 300000,
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&auto=format&fit=crop&q=80',
    description: 'Khám và điều trị các bệnh lý về da',
    doctorCount: 2
  },
  {
    id: 2,
    name: 'Khám nội tổng quát',
    price: 500000,
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200&auto=format&fit=crop&q=80',
    description: 'Khám sức khỏe tổng quát, nội khoa',
    doctorCount: 2
  },
  {
    id: 3,
    name: 'Khám tai mũi họng',
    price: 250000,
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=200&auto=format&fit=crop&q=80',
    description: 'Khám và điều trị tai mũi họng',
    doctorCount: 1
  }
];

const ServiceMgmt = () => {
  const [services, setServices] = useState(mockServices);
  const [editingService, setEditingService] = useState(null);

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Danh sách dịch vụ khám</h2>
          <p className="text-xs text-slate-500 mt-1">Quản lý các gói khám bệnh và bảng giá kỹ thuật MediClinic</p>
        </div>
        <button className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/30">
          <Plus className="w-4 h-4" />
          <span>+ Thêm mới</span>
        </button>
      </div>

      {/* Bảng Danh sách dịch vụ (Hình 3.5 trên) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="py-4 px-6">Dịch vụ</th>
                <th className="py-4 px-6">Hình ảnh</th>
                <th className="py-4 px-6">Mô tả</th>
                <th className="py-4 px-6">Giá (VNĐ)</th>
                <th className="py-4 px-6 text-center">Số lượng bác sĩ</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-6 font-bold text-slate-900">{s.name}</td>
                  <td className="py-4 px-6">
                    <img src={s.image} alt={s.name} className="w-14 h-10 rounded-xl object-cover border border-slate-200" />
                  </td>
                  <td className="py-4 px-6 text-slate-600">{s.description}</td>
                  <td className="py-4 px-6 font-black text-emerald-600">{s.price.toLocaleString()}</td>
                  <td className="py-4 px-6 text-center font-bold text-sky-600">{s.doctorCount}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setEditingService(s)}
                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM / MODAL CẬP NHẬT DỊCH VỤ (HÌNH 3.5 DƯỚI) */}
      {editingService && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingService(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Cập nhật dịch vụ</h3>
              <button onClick={() => setEditingService(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setEditingService(null); }} className="space-y-4 text-xs">
              <span className="font-bold text-sky-700 uppercase tracking-wider block text-[11px]">Thông tin dịch vụ</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Tên dịch vụ</label>
                  <input
                    type="text"
                    value={editingService.name}
                    onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Giá tiền (VNĐ)</label>
                  <input
                    type="number"
                    value={editingService.price}
                    onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Mô tả dịch vụ</label>
                <textarea
                  rows={3}
                  value={editingService.description}
                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Upload hình ảnh (Hình 3.5) */}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Hình ảnh dịch vụ</label>
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50 transition cursor-pointer">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <span className="text-xs text-slate-500 font-semibold">Tải lên hình ảnh mới</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition"
                >
                  Hoàn tác
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  Cập nhật thông tin
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

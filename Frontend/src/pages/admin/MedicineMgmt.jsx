import React, { useState } from 'react';
import { Pill, Plus, Search, Filter, Edit, Trash2, Clock, Utensils, X } from 'lucide-react';

const mockDrugs = [
  { id: 1, name: 'Paracetamol', activeIngredient: 'Acetaminophen', packing: 'Hộp 10 vỉ x 10 viên', sideEffect: 'Buồn nôn, dị ứng', updatedAt: '2025-09-20' },
  { id: 2, name: 'Amoxicillin', activeIngredient: 'Amoxicillin trihydrate', packing: 'Hộp 1 vỉ x 10 viên', sideEffect: 'Tiêu chảy, phát ban', updatedAt: '2025-09-22' },
  { id: 3, name: 'Cetirizine', activeIngredient: 'Cetirizine hydrochloride', packing: 'Hộp 5 vỉ x 10 viên', sideEffect: 'Khô miệng, buồn ngủ nhẹ', updatedAt: '2025-09-25' },
  { id: 4, name: 'Omeprazole', activeIngredient: 'Omeprazole 20mg', packing: 'Hộp 3 vỉ x 10 viên', sideEffect: 'Đau đầu, đầy hơi', updatedAt: '2025-09-28' },
];

const mockUnits = [
  { id: 1, name: 'Viên', desc: 'Dạng viên nén hoặc nang' },
  { id: 2, name: 'Vỉ', desc: 'Vỉ thuốc chứa nhiều viên' },
  { id: 3, name: 'Hộp', desc: 'Hộp chứa nhiều vỉ' },
  { id: 4, name: 'Chai', desc: 'Chai dung dịch, siro' },
  { id: 5, name: 'Gói', desc: 'Gói bột pha nước uống' },
];

const mockDosageTimes = [
  { id: 1, time: 'Sáng', desc: 'Uống thuốc vào buổi sáng' },
  { id: 2, time: 'Trưa', desc: 'Uống thuốc vào buổi trưa' },
  { id: 3, time: 'Chiều', desc: 'Uống thuốc vào buổi chiều' },
  { id: 4, time: 'Tối', desc: 'Uống thuốc vào buổi tối' },
];

const mockMealRelations = [
  { id: 1, relation: 'Trước ăn', desc: 'Uống thuốc trước khi ăn 30 phút' },
  { id: 2, relation: 'Sau ăn', desc: 'Uống thuốc sau khi ăn no' },
  { id: 3, relation: 'Trong lúc ăn', desc: 'Uống thuốc trong bữa ăn' },
];

const MedicineMgmt = () => {
  const [activeTab, setActiveTab] = useState('drugs'); // 'drugs' | 'units' | 'times'
  const [drugs, setDrugs] = useState(mockDrugs);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDrugs = drugs.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* 3 Tabs Trên (Hình 3.2) */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('drugs')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'drugs' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Thuốc
          </button>
          <button
            onClick={() => setActiveTab('units')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'units' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Đơn vị thuốc
          </button>
          <button
            onClick={() => setActiveTab('times')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'times' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Thời điểm uống thuốc
          </button>
        </div>

        {activeTab === 'drugs' && (
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition">
              <Filter className="w-3.5 h-3.5" />
              <span>Bộ lọc</span>
            </button>
            <button className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm mới</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DANH SÁCH THUỐC (HÌNH 3.2 TRÊN)                    */}
      {/* ======================================================== */}
      {activeTab === 'drugs' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-base">Danh sách thuốc</h3>
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
                  <th className="p-3.5">Tên thuốc</th>
                  <th className="p-3.5">Hoạt chất</th>
                  <th className="p-3.5">Quy cách</th>
                  <th className="p-3.5">Tác dụng phụ</th>
                  <th className="p-3.5">Cập nhật</th>
                  <th className="p-3.5 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrugs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-slate-900">{d.name}</td>
                    <td className="p-3.5 text-slate-600 italic">{d.activeIngredient}</td>
                    <td className="p-3.5 text-slate-700">{d.packing}</td>
                    <td className="p-3.5 text-rose-600">{d.sideEffect}</td>
                    <td className="p-3.5 text-slate-400">{d.updatedAt}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ĐƠN VỊ THUỐC (HÌNH 3.2 GIỮA)                      */}
      {/* ======================================================== */}
      {activeTab === 'units' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-base">Danh sách đơn vị thuốc</h3>
            <button className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm mới</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                  <th className="p-3.5 w-40">Đơn vị</th>
                  <th className="p-3.5">Mô tả</th>
                  <th className="p-3.5 text-center w-28">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockUnits.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-slate-900">{u.name}</td>
                    <td className="p-3.5 text-slate-600">{u.desc}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: THỜI ĐIỂM UỐNG & SO VỚI BỮA ĂN (HÌNH 3.2 DƯỚI)    */}
      {/* ======================================================== */}
      {activeTab === 'times' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bảng 1: Thời điểm uống thuốc */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm">Thời điểm uống thuốc</h3>
              <button className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm mới</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                    <th className="p-3 w-28">Thời gian</th>
                    <th className="p-3">Mô tả</th>
                    <th className="p-3 text-center w-24">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockDosageTimes.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-bold text-slate-900">{t.time}</td>
                      <td className="p-3 text-slate-600">{t.desc}</td>
                      <td className="p-3 text-center">
                        <button className="p-1 text-sky-600 hover:bg-sky-50 rounded-lg">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bảng 2: Uống so với bữa ăn */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-800 text-sm">Uống so với bữa ăn</h3>
              <button className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm">
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm mới</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                    <th className="p-3 w-32">Thời điểm</th>
                    <th className="p-3">Mô tả</th>
                    <th className="p-3 text-center w-24">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mockMealRelations.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition">
                      <td className="p-3 font-bold text-slate-900">{m.relation}</td>
                      <td className="p-3 text-slate-600">{m.desc}</td>
                      <td className="p-3 text-center">
                        <button className="p-1 text-sky-600 hover:bg-sky-50 rounded-lg">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineMgmt;

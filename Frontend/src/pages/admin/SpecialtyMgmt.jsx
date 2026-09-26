import React, { useState } from 'react';
import { Plus, Eye, Edit, Trash2, X, Stethoscope, Users, Mail } from 'lucide-react';

const mockSpecialties = [
  {
    id: 1,
    name: 'Chuyên khoa nội',
    description: 'Chuyên khoa nội tổng quát, khám và điều trị các bệnh lý tim mạch, tiêu hóa, hô hấp.',
    doctorCount: 4,
    doctors: [
      { name: 'Nguyễn Văn An', email: 'doctor.an@mediclinic.com', room: 'Phòng khám Nội', avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&auto=format&fit=crop&q=80' },
      { name: 'Phạm Văn C', email: 'cpham@mediclinic.com', room: 'Phòng khám Nhi', avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&auto=format&fit=crop&q=80' }
    ]
  },
  {
    id: 2,
    name: 'Chuyên khoa ngoại',
    description: 'Chuyên khoa ngoại, khám và phẫu thuật chấn thương chỉnh hình mô mềm.',
    doctorCount: 2,
    doctors: [
      { name: 'Trần Thị Bình', email: 'doctor.binh@mediclinic.com', room: 'Phòng khám Ngoại', avatar: 'https://images.unsplash.com/photo-1594824813583-82f5b61e2715?w=100&auto=format&fit=crop&q=80' }
    ]
  }
];

const SpecialtyMgmt = () => {
  const [specialties, setSpecialties] = useState(mockSpecialties);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Danh sách chuyên khoa</h2>
          <p className="text-xs text-slate-500 mt-1">Quản lý danh mục các chuyên khoa khám bệnh MediClinic</p>
        </div>
        <button className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/30">
          <Plus className="w-4 h-4" />
          <span>+ Thêm mới</span>
        </button>
      </div>

      {/* Bảng Danh sách chuyên khoa (Hình 3.3 trên) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="py-4 px-6">Chuyên khoa</th>
                <th className="py-4 px-6">Mô tả</th>
                <th className="py-4 px-6 text-center">Số lượng bác sĩ</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {specialties.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-6 font-bold text-slate-900">{s.name}</td>
                  <td className="py-4 px-6 text-slate-600">{s.description}</td>
                  <td className="py-4 px-6 text-center font-black text-sky-600">{s.doctorCount}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setSelectedSpecialty(s)}
                        title="Xem chi tiết"
                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition">
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

      {/* MODAL THÔNG TIN CHUYÊN KHOA (HÌNH 3.3 DƯỚI) */}
      {selectedSpecialty && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSpecialty(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Thông tin chuyên khoa</h3>
              <button onClick={() => setSelectedSpecialty(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-1">Tên chuyên khoa:</span>
                  <strong className="text-slate-800 text-sm">{selectedSpecialty.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Mô tả:</span>
                  <p className="text-slate-600">{selectedSpecialty.description}</p>
                </div>
              </div>

              {/* Bác sĩ thuộc chuyên khoa */}
              <div className="space-y-2">
                <span className="font-bold text-sky-800 uppercase tracking-wider block text-[11px]">
                  Bác sĩ thuộc: {selectedSpecialty.name}
                </span>

                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                        <th className="p-3">Họ tên</th>
                        <th className="p-3">Ảnh</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Phòng khám</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSpecialty.doctors?.map((doc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{doc.name}</td>
                          <td className="p-3">
                            <img src={doc.avatar} alt={doc.name} className="w-8 h-8 rounded-full object-cover" />
                          </td>
                          <td className="p-3 text-slate-600">{doc.email}</td>
                          <td className="p-3 text-slate-600">{doc.room}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedSpecialty(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialtyMgmt;

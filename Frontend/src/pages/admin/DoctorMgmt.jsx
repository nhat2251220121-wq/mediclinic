import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, Filter, UserCheck, Shield, Phone, Mail } from 'lucide-react';

const mockDoctorsList = [
  {
    id: 1,
    name: 'Nguyễn Văn An',
    phone: '0987654321',
    role: 'Admin',
    department: 'Phòng khám nội',
    specialty: 'Chuyên khoa nội',
    status: 'ACTIVE',
    email: 'doctor.an@mediclinic.com',
    dob: '12/05/1980',
    gender: 'Nam',
    address: 'Hà Nội'
  },
  {
    id: 2,
    name: 'Trần Thị Bình',
    phone: '0912345678',
    role: 'Manager',
    department: 'Phòng khám da liễu',
    specialty: 'Chuyên khoa ngoại',
    status: 'ACTIVE',
    email: 'doctor.binh@mediclinic.com',
    dob: '20/08/1985',
    gender: 'Nữ',
    address: 'TP.HCM'
  },
  {
    id: 3,
    name: 'Lê Văn C',
    phone: '0901122234',
    role: 'Employee',
    department: 'Phòng khám nội',
    specialty: 'Chuyên khoa nội',
    status: 'ACTIVE',
    email: 'cvan@mediclinic.com',
    dob: '10/03/1990',
    gender: 'Nam',
    address: 'Đà Nẵng'
  }
];

const DoctorMgmt = () => {
  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'roles'
  const [doctors, setDoctors] = useState(mockDoctorsList);
  const [editingDoc, setEditingDoc] = useState(null);

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Tabs (Hình 3.6) */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'accounts' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tài khoản
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-5 py-2.5 rounded-xl transition ${
              activeTab === 'roles' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Nhóm quyền
          </button>
        </div>

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
      </div>

      {/* Bảng Danh sách bác sĩ / nhân viên (Hình 3.6 trên) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-4">
        <h3 className="font-black text-slate-800 text-base">Danh sách bác sĩ</h3>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Họ tên</th>
                <th className="p-3.5">Số điện thoại</th>
                <th className="p-3.5">Vai trò</th>
                <th className="p-3.5">Phòng ban</th>
                <th className="p-3.5">Chuyên môn</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3.5 font-bold text-sky-600">#{doc.id}</td>
                  <td className="p-3.5 font-bold text-slate-900">{doc.name}</td>
                  <td className="p-3.5 text-slate-600">{doc.phone}</td>
                  <td className="p-3.5 text-slate-700">{doc.role}</td>
                  <td className="p-3.5 text-slate-600">{doc.department}</td>
                  <td className="p-3.5 text-teal-700 font-semibold">{doc.specialty}</td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {doc.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setEditingDoc(doc)}
                        className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button className="px-2.5 py-1 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg text-[11px] font-semibold transition">
                        Đặt lại mật khẩu
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CẬP NHẬT TÀI KHOẢN (HÌNH 3.6 DƯỚI) */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingDoc(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Cập nhật tài khoản</h3>
              <button onClick={() => setEditingDoc(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setEditingDoc(null); }} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Họ tên</label>
                  <input
                    type="text"
                    value={editingDoc.name}
                    onChange={(e) => setEditingDoc({ ...editingDoc, name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Email</label>
                  <input
                    type="email"
                    value={editingDoc.email}
                    onChange={(e) => setEditingDoc({ ...editingDoc, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Số điện thoại</label>
                  <input
                    type="tel"
                    value={editingDoc.phone}
                    onChange={(e) => setEditingDoc({ ...editingDoc, phone: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">* Vai trò</label>
                  <input
                    type="text"
                    value={editingDoc.role}
                    onChange={(e) => setEditingDoc({ ...editingDoc, role: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Phòng khám</label>
                  <input
                    type="text"
                    value={editingDoc.department}
                    onChange={(e) => setEditingDoc({ ...editingDoc, department: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Chuyên khoa</label>
                  <input
                    type="text"
                    value={editingDoc.specialty}
                    onChange={(e) => setEditingDoc({ ...editingDoc, specialty: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-700"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Ngày sinh</label>
                  <input
                    type="text"
                    value={editingDoc.dob}
                    onChange={(e) => setEditingDoc({ ...editingDoc, dob: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Giới tính</label>
                  <input
                    type="text"
                    value={editingDoc.gender}
                    onChange={(e) => setEditingDoc({ ...editingDoc, gender: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold text-slate-600 block mb-1">Địa chỉ</label>
                  <input
                    type="text"
                    value={editingDoc.address}
                    onChange={(e) => setEditingDoc({ ...editingDoc, address: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition"
                >
                  Hoàn tác
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition shadow-sm"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorMgmt;

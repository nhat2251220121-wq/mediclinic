import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, Building, Users } from 'lucide-react';

const mockRooms = [
  { id: 1, name: 'Phòng Khám Nội Tổng Quát', location: 'Tầng 1 - Phòng 101', doctorCount: 4 },
  { id: 2, name: 'Phòng Khám Nhi', location: 'Tầng 1 - Phòng 102', doctorCount: 2 },
  { id: 3, name: 'Phòng Khám Tai Mũi Họng', location: 'Tầng 2 - Phòng 201', doctorCount: 1 },
  { id: 4, name: 'Phòng Khám Răng Hàm Mặt', location: 'Tầng 2 - Phòng 202', doctorCount: 2 },
  { id: 5, name: 'Phòng Khám Sản Phụ Khoa', location: 'Tầng 3 - Phòng 301', doctorCount: 1 },
];

const RoomMgmt = () => {
  const [rooms, setRooms] = useState(mockRooms);
  const [editingRoom, setEditingRoom] = useState(null);

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Danh sách phòng khám</h2>
          <p className="text-xs text-slate-500 mt-1">Quản lý cơ sở vật chất phòng khám tại MediClinic</p>
        </div>
        <button className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/30">
          <Plus className="w-4 h-4" />
          <span>+ Thêm mới</span>
        </button>
      </div>

      {/* Bảng Danh sách phòng khám (Hình 3.4 trên) */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="py-4 px-6">Phòng</th>
                <th className="py-4 px-6">Địa điểm</th>
                <th className="py-4 px-6 text-center">Số lượng bác sĩ</th>
                <th className="py-4 px-6 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-4 px-6 font-bold text-slate-900">{r.name}</td>
                  <td className="py-4 px-6 text-slate-600">{r.location}</td>
                  <td className="py-4 px-6 text-center font-black text-sky-600">{r.doctorCount}</td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setEditingRoom(r)}
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

      {/* MODAL CẬP NHẬT PHÒNG KHÁM (HÌNH 3.4 DƯỚI) */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditingRoom(null)}></div>
          <div className="relative bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Cập nhật phòng khám</h3>
              <button onClick={() => setEditingRoom(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setEditingRoom(null); }} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Tên phòng khám</label>
                <input
                  type="text"
                  value={editingRoom.name}
                  onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Địa điểm phòng khám</label>
                <input
                  type="text"
                  value={editingRoom.location}
                  onChange={(e) => setEditingRoom({ ...editingRoom, location: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
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

export default RoomMgmt;

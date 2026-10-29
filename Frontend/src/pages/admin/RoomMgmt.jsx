import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Building, Plus, Search, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import DoctorCountDetailsButton from './DoctorCountDetailsButton';

const RoomMgmt = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ room_number: '', name: '', location: '' });
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/rooms');
      if (res.success) setRooms(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách phòng khám:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({ room_number: '', name: '', location: 'Tầng 1 - Dãy A' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ room_number: item.room_number || '', name: item.name || '', location: item.location || '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axiosClient.put(`/admin/rooms/${editingItem.id}`, formData);
      } else {
        await axiosClient.post('/admin/rooms', formData);
      }
      setIsModalOpen(false);
      fetchRooms();
    } catch (err) {
      alert('Lỗi lưu phòng khám: ' + (err.message || 'Lỗi server'));
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Ngừng sử dụng phòng “${item.name}” (${item.room_number})? Bác sĩ, lịch khám và hồ sơ cũ vẫn được giữ.`)) return;
    setPendingDeleteId(item.id); setActionNotice(null);
    try {
      const result = await axiosClient.delete(`/admin/rooms/${item.id}`);
      setRooms((current) => current.map((room) => room.id === item.id ? { ...room, is_active: false } : room));
      setActionNotice({ type: 'success', message: result.message || `Đã ngừng phòng “${item.name}”.` });
      await fetchRooms();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không ngừng được phòng khám. Dữ liệu hiện có chưa bị xóa.' });
    } finally { setPendingDeleteId(null); }
  };

  const filtered = rooms.filter(r =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.room_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Phòng Khám & Vị Trí</h2>
          <p className="text-sm text-slate-500 mt-1">Danh sách các phòng chức năng, phòng khám bác sĩ theo tầng.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRooms}
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
            <span>+ Thêm mới phòng khám</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách phòng khám</h3>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo số phòng hoặc tên..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="p-3.5 w-28">Số phòng</th>
                <th className="p-3.5">Tên phòng khám</th>
                <th className="p-3.5">Vị trí / Tầng</th>
                <th className="p-3.5 text-center w-36">Số lượng bác sĩ</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-center w-28">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">Đang tải danh sách phòng...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">Chưa có dữ liệu phòng khám.</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-sky-600">{item.room_number}</td>
                    <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                    <td className="p-3.5 text-slate-600">{item.location || 'Tầng 1'}</td>
                    <td className="p-3.5 text-center font-semibold text-slate-700"><span>{Number(item.doctor_count) || 0}</span><DoctorCountDetailsButton item={item} relation="room" /></td>
                    <td className="p-3.5">{item.is_active ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">Đang dùng</span> : <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-bold text-slate-600">Đã ngừng</span>}</td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleOpenEdit(item)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {item.is_active && <button disabled={pendingDeleteId === item.id} title="Ngừng sử dụng; giữ lịch sử liên quan" onClick={() => handleDelete(item)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50">
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
                {editingItem ? 'Chỉnh sửa phòng khám' : 'Thêm phòng khám mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Số phòng (VD: P.101)</label>
                <input
                  type="text"
                  required
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Tên phòng khám</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Phòng Khám Nội Tổng Quát"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Vị trí / Tầng</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ví dụ: Tầng 1 - Dãy A"
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
                  Lưu phòng khám
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

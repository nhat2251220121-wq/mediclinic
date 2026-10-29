import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Search, RefreshCw, Check, X, Edit, Eye } from 'lucide-react';
import PatientDetailModal from './PatientDetailModal';

const PatientMgmt = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingStatusId, setPendingStatusId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Modal Sửa bệnh nhân
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientToView, setPatientToView] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    insurance_code: '',
    citizen_id: '',
    is_active: 1
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/admin/patients');
      if (res.success) setPatients(res.data);
    } catch (err) {
      console.error('Lỗi lấy danh sách bệnh nhân:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (p) => {
    setSelectedPatient(p);
    setFormData({
      full_name: p.full_name || '',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      insurance_code: p.insurance_code || '',
      citizen_id: p.citizen_id || '',
      is_active: p.is_active !== undefined ? p.is_active : 1
    });
  };

  const handleToggleActive = async (p) => {
    const newStatus = p.is_active ? 0 : 1;
    const action = newStatus ? 'mở khóa' : 'khóa';
    if (!window.confirm(`${action === 'khóa' ? 'Khóa' : 'Mở khóa'} tài khoản bệnh nhân “${p.full_name}”? Bệnh án, lịch sử khám, hóa đơn và thanh toán không bị xóa.`)) return;
    setPendingStatusId(p.id); setActionNotice(null);
    try {
      const result = await axiosClient.put(`/admin/patients/${p.id}`, {
        ...p,
        is_active: newStatus
      });
      setPatients((current) => current.map((patient) => patient.id === p.id ? { ...patient, is_active: newStatus } : patient));
      setActionNotice({ type: 'success', message: result.message || `Đã ${action} tài khoản bệnh nhân “${p.full_name}”.` });
      await fetchPatients();
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Không cập nhật được trạng thái tài khoản.' });
    } finally { setPendingStatusId(null); }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put(`/admin/patients/${selectedPatient.id}`, formData);
      setSelectedPatient(null);
      fetchPatients();
    } catch (err) {
      alert('Lỗi cập nhật bệnh nhân: ' + (err.message || 'Lỗi server'));
    }
  };

  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.phone?.includes(searchTerm) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Hồ Sơ Bệnh Nhân</h2>
          <p className="text-sm text-slate-500 mt-1">Danh sách thông tin bệnh nhân đã đăng ký trên hệ thống MediClinic.</p>
        </div>

        <button
          onClick={fetchPatients}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-4 h-4 text-sky-600" />
          <span>Làm mới</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách bệnh nhân</h3>
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên, SĐT hoặc email..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                <th className="p-3.5 w-16">Mã</th>
                <th className="p-3.5">Họ và tên</th>
                <th className="p-3.5">Số điện thoại</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Mã BHYT</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5 text-center w-28">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Đang tải danh sách bệnh nhân...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-400">Không tìm thấy bệnh nhân nào.</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-bold text-sky-600">#{p.id}</td>
                    <td className="p-3.5 font-bold text-slate-900">{p.full_name}</td>
                    <td className="p-3.5 text-slate-700 font-medium">{p.phone}</td>
                    <td className="p-3.5 text-slate-500">{p.email || 'Chưa cập nhật'}</td>
                    <td className="p-3.5 text-teal-700 font-semibold">{p.insurance_code || 'Không có'}</td>
                    <td className="p-3.5">
                      {p.is_active ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-md border border-emerald-200">Hoạt động</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-md border border-rose-200">Đã khóa</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setPatientToView(p)} title="Xem hồ sơ và lịch sử khám" aria-label={`Xem hồ sơ bệnh nhân ${p.full_name}`} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleOpenEdit(p)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={pendingStatusId === p.id}
                          onClick={() => handleToggleActive(p)}
                          title={p.is_active ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                          className={`p-1.5 rounded-lg disabled:opacity-50 ${p.is_active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          {pendingStatusId === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : p.is_active ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
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

      {patientToView && <PatientDetailModal key={patientToView.id} patient={patientToView} onClose={() => setPatientToView(null)} />}

      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedPatient(null)} />
          <div className="relative bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">Sửa thông tin bệnh nhân #{selectedPatient.id}</h3>
              <button onClick={() => setSelectedPatient(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Số điện thoại</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Địa chỉ thường trú</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-700 shadow-sm"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMgmt;

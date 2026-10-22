import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Plus, Search, RefreshCw, Mail, Phone, Building, X, Pencil } from 'lucide-react';
import ImageWithFallback from '../../components/common/ImageWithFallback';

const DoctorMgmt = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [saveError, setSaveError] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', specialty_id: '', room_id: '', bio: '', experience_years: 0, consultation_fee: 0 });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const [res, specialtyResult, roomResult] = await Promise.all([
        axiosClient.get('/admin/doctors'), axiosClient.get('/admin/specialties'), axiosClient.get('/admin/rooms')
      ]);
      if (res.success) setDoctors(res.data);
      setSpecialties(specialtyResult.data || []);
      setRooms(roomResult.data || []);
    } catch (err) {
      console.error('Lỗi lấy danh sách bác sĩ:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveDoctor = async (event) => {
    event.preventDefault(); setSaveError('');
    try {
      const payload = { ...form, specialty_id: form.specialty_id || null, room_id: form.room_id || null };
      let doctorId = editingDoctor?.id;
      if (editingDoctor) {
        await axiosClient.put(`/admin/doctors/${editingDoctor.id}`, { ...payload, is_active: editingDoctor.doctor_active && editingDoctor.account_active });
      } else {
        const result = await axiosClient.post('/admin/doctors', payload);
        doctorId = result.data?.id;
        setEditingDoctor({ id: doctorId, doctor_active: true, account_active: true });
      }
      if (avatarFile && doctorId) {
        const data = new FormData(); data.append('image', avatarFile);
        await axiosClient.post(`/admin/doctors/${doctorId}/avatar`, data);
      }
      if (removeAvatar && doctorId) await axiosClient.delete(`/admin/doctors/${doctorId}/avatar`);
      setShowCreate(false);
      setEditingDoctor(null);
      setAvatarFile(null); setAvatarPreview(''); setRemoveAvatar(false);
      setForm({ full_name: '', phone: '', email: '', password: '', specialty_id: '', room_id: '', bio: '', experience_years: 0, consultation_fee: 0 });
      await fetchDoctors();
    } catch (error) { setSaveError(error.message || 'Không tạo được tài khoản bác sĩ.'); }
  };

  const openEdit = (doctor) => {
    setEditingDoctor(doctor);
    setForm({ full_name: doctor.full_name || '', phone: doctor.phone || '', email: doctor.email || '', password: '', specialty_id: doctor.specialty_id || '', room_id: doctor.room_id || '', bio: doctor.bio || '', experience_years: doctor.experience_years ?? 0, consultation_fee: doctor.consultation_fee ?? 0 });
    setAvatarFile(null); setAvatarPreview(doctor.avatar_url || ''); setRemoveAvatar(false);
    setSaveError('');
    setShowCreate(true);
  };

  const deactivateDoctor = async (doctor) => {
    if (!window.confirm(`Ngừng hoạt động tài khoản ${doctor.full_name}? Lịch sử khám vẫn được giữ.`)) return;
    try { await axiosClient.delete(`/admin/doctors/${doctor.id}`); await fetchDoctors(); }
    catch (error) { setSaveError(error.message || 'Không cập nhật được bác sĩ.'); }
  };

  const filtered = doctors.filter(d =>
    d.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.specialty_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Đội Ngũ Bác Sĩ</h2>
          <p className="text-sm text-slate-500 mt-1">Danh sách thông tin bác sĩ chuyên khoa, phòng làm việc và học vị.</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />Tạo tài khoản bác sĩ</button>
          <button
            onClick={fetchDoctors}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-4 h-4 text-sky-600" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {saveError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{saveError}</div>}
      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
        <form onSubmit={saveDoctor} className="my-auto w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{editingDoctor ? 'Cập nhật bác sĩ' : 'Tạo tài khoản bác sĩ'}</h3><button type="button" onClick={() => { setShowCreate(false); setEditingDoctor(null); setAvatarFile(null); setAvatarPreview(''); setRemoveAvatar(false); }} aria-label="Đóng"><X className="h-5 w-5" /></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 sm:col-span-2"><ImageWithFallback src={avatarPreview} alt="Ảnh bác sĩ" className="h-16 w-16 rounded-full object-cover" fallback={<span className="font-bold text-xl">{form.full_name?.charAt(0) || 'B'}</span>} /><label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">{avatarPreview ? 'Thay ảnh đại diện' : 'Chọn ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event)=>{ const file=event.target.files?.[0]; if (!file) return; if (file.size > 5*1024*1024) { setSaveError('Ảnh không được vượt quá 5 MB.'); return; } setAvatarFile(file); setRemoveAvatar(false); setAvatarPreview(URL.createObjectURL(file)); setSaveError(''); }} /></label>{avatarPreview && <button type="button" onClick={()=>{ if (avatarFile) { setAvatarFile(null); setAvatarPreview(editingDoctor?.avatar_url || ''); setRemoveAvatar(false); } else { setAvatarPreview(''); setRemoveAvatar(Boolean(editingDoctor?.avatar_url)); } }} className="text-sm text-rose-700">Bỏ ảnh</button>}</div>
            {[['full_name','Họ và tên','text'],['phone','Số điện thoại','tel'],['email','Email','email'],...(!editingDoctor ? [['password','Mật khẩu khởi tạo (12 ký tự trở lên)','password']] : []),['experience_years','Số năm kinh nghiệm','number'],['consultation_fee','Phí khám (VND)','number']].map(([key,label,type]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><input required={['full_name','phone','email','password','consultation_fee'].includes(key)} type={type} min={type==='number'?0:undefined} value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
            <label className="space-y-1 text-sm"><span>Chuyên khoa</span><select value={form.specialty_id} onChange={(event)=>setForm({...form,specialty_id:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chưa phân công</option>{specialties.filter((item)=>item.is_active).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Phòng khám</span><select value={form.room_id} onChange={(event)=>setForm({...form,room_id:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chưa phân công</option>{rooms.filter((item)=>item.is_active).map((item)=><option key={item.id} value={item.id}>{item.name} ({item.room_number})</option>)}</select></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span>Giới thiệu</span><textarea value={form.bio} onChange={(event)=>setForm({...form,bio:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} /></label>
          </div>
          {editingDoctor && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingDoctor.doctor_active && editingDoctor.account_active} onChange={(event)=>setEditingDoctor({...editingDoctor, doctor_active:event.target.checked, account_active:event.target.checked})} /> Tài khoản đang hoạt động</label>}
          <div className="flex justify-end gap-2"><button type="button" onClick={()=>{setShowCreate(false);setEditingDoctor(null);setAvatarFile(null);setAvatarPreview('');setRemoveAvatar(false);}} className="rounded-lg border px-4 py-2 text-sm">Hủy</button><button className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white">{editingDoctor ? 'Lưu thay đổi' : 'Tạo bác sĩ'}</button></div>
        </form>
      </div>}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách bác sĩ</h3>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bác sĩ hoặc chuyên khoa..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full text-center py-8 text-slate-400 text-xs">Đang tải danh sách bác sĩ...</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-8 text-slate-400 text-xs">Chưa có bác sĩ nào.</div>
          ) : (
            filtered.map((doc) => (
              <div key={doc.id} className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200 space-y-3 shadow-sm hover:shadow-md transition">
                <div className="flex items-center gap-3">
                  <ImageWithFallback src={doc.avatar_url} alt={doc.full_name} className="w-12 h-12 rounded-2xl object-cover flex-shrink-0" fallback={<span className="font-black text-lg">{doc.full_name?.charAt(0) || 'B'}</span>} />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{doc.full_name}</h4>
                    <span className="text-xs font-semibold text-teal-700">{doc.specialty_name || 'Bác sĩ Chuyên khoa'}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400" />
                    <span>Phòng: <strong>{doc.room_name || doc.room_number || 'Chưa phân công'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>SĐT: {doc.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>Email: {doc.email || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="text-emerald-700 font-bold pt-1">
                    Phí khám: {Number(doc.consultation_fee ?? 0).toLocaleString('vi-VN')} ₫
                  </div>
                  <div className={`pt-1 font-medium ${doc.doctor_active && doc.account_active ? 'text-emerald-700' : 'text-slate-500'}`}>{doc.doctor_active && doc.account_active ? 'Đang hoạt động' : 'Đã ngừng hoạt động'}</div>
                </div>
                <div className="flex flex-wrap gap-2"><button onClick={() => openEdit(doc)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-white"><Pencil className="h-3.5 w-3.5" />Sửa hồ sơ</button>{(doc.doctor_active && doc.account_active) && <button onClick={() => deactivateDoctor(doc)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50">Ngừng hoạt động</button>}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorMgmt;

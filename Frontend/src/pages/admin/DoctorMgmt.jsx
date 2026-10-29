import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Plus, Search, RefreshCw, Mail, Phone, Building, X, Pencil } from 'lucide-react';
import ImageWithFallback from '../../components/common/ImageWithFallback';

const doctorIsActive = (doctor) => Number(doctor.doctor_active) === 1 && Number(doctor.account_active) === 1;

const DoctorMgmt = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorTab, setDoctorTab] = useState('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [saveError, setSaveError] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState(null);
  const [pendingActivateId, setPendingActivateId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', specialty_id: '', room_id: '', bio: '', experience_years: 0 });

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
    event.preventDefault(); setSaveError(''); setIsSaving(true);
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
      if (removeAvatar && doctorId) {
        const result = await axiosClient.delete(`/admin/doctors/${doctorId}/avatar`);
        setActionNotice({ type: result.cleanupWarning ? 'error' : 'success', message: result.message || 'Đã bỏ ảnh đại diện bác sĩ.' });
      }
      setShowCreate(false);
      setEditingDoctor(null);
      setAvatarFile(null); setAvatarPreview(''); setRemoveAvatar(false);
      setForm({ full_name: '', phone: '', email: '', password: '', specialty_id: '', room_id: '', bio: '', experience_years: 0 });
      await fetchDoctors();
    } catch (error) { setSaveError(error.message || 'Không tạo được tài khoản bác sĩ.'); }
    finally { setIsSaving(false); }
  };

  const openEdit = (doctor) => {
    setEditingDoctor(doctor);
    setForm({ full_name: doctor.full_name || '', phone: doctor.phone || '', email: doctor.email || '', password: '', specialty_id: doctor.specialty_id || '', room_id: doctor.room_id || '', bio: doctor.bio || '', experience_years: doctor.experience_years ?? 0 });
    setAvatarFile(null); setAvatarPreview(doctor.avatar_url || ''); setRemoveAvatar(false);
    setSaveError('');
    setShowCreate(true);
  };

  const deactivateDoctor = async (doctor) => {
    if (!window.confirm(`Ngừng hoạt động tài khoản bác sĩ “${doctor.full_name}”? Bác sĩ sẽ không nhận lịch mới; lịch hẹn, bệnh án và đơn thuốc cũ vẫn được giữ.`)) return;
    setPendingDeactivateId(doctor.id); setActionNotice(null);
    try {
      const result = await axiosClient.delete(`/admin/doctors/${doctor.id}`);
      setDoctors((current) => current.map((item) => item.id === doctor.id ? { ...item, doctor_active: 0, account_active: 0 } : item));
      setActionNotice({ type: 'success', message: result.message || `Đã ngừng tài khoản bác sĩ “${doctor.full_name}”.` });
      await fetchDoctors();
    } catch (error) { setActionNotice({ type: 'error', message: error.message || 'Không ngừng được tài khoản bác sĩ.' }); }
    finally { setPendingDeactivateId(null); }
  };

  const reactivateDoctor = async (doctor) => {
    if (!window.confirm(`Kích hoạt lại tài khoản bác sĩ “${doctor.full_name}” để nhận lịch mới?`)) return;
    setPendingActivateId(doctor.id); setActionNotice(null);
    try {
      const result = await axiosClient.put(`/admin/doctors/${doctor.id}`, {
        full_name: doctor.full_name,
        phone: doctor.phone,
        email: doctor.email,
        specialty_id: doctor.specialty_id || null,
        room_id: doctor.room_id || null,
        bio: doctor.bio || null,
        experience_years: doctor.experience_years ?? 0,
        is_active: true
      });
      setActionNotice({ type: 'success', message: result.message || `Đã kích hoạt lại bác sĩ “${doctor.full_name}”.` });
      await fetchDoctors();
    } catch (error) { setActionNotice({ type: 'error', message: error.message || 'Không kích hoạt lại được bác sĩ.' }); }
    finally { setPendingActivateId(null); }
  };

  const activeDoctors = doctors.filter(doctorIsActive);
  const inactiveDoctors = doctors.filter((doctor) => !doctorIsActive(doctor));
  const visibleDoctors = (doctorTab === 'ACTIVE' ? activeDoctors : inactiveDoctors).filter((doctor) =>
    `${doctor.full_name || ''} ${doctor.specialty_name || ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {actionNotice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${actionNotice.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{actionNotice.message}</div>}
      <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Quản Lý Đội Ngũ Bác Sĩ</h2>
          <p className="text-sm text-slate-500 mt-1">Danh sách thông tin bác sĩ chuyên khoa, phòng làm việc và học vị.</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="px-4 py-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Tạo tài khoản bác sĩ</button>
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
            <div className="flex items-center gap-3 sm:col-span-2"><ImageWithFallback src={avatarPreview} alt="Ảnh bác sĩ" className="h-16 w-16 rounded-full object-cover" fallback={<span className="font-bold text-xl">{form.full_name?.charAt(0) || 'B'}</span>} /><label className="cursor-pointer rounded-lg border px-3 py-2 text-sm">{avatarPreview ? 'Thay ảnh đại diện' : 'Chọn ảnh đại diện'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event)=>{ const file=event.target.files?.[0]; if (!file) return; if (file.size > 5*1024*1024) { setSaveError('Ảnh không được vượt quá 5 MB.'); return; } setAvatarFile(file); setRemoveAvatar(false); setAvatarPreview(URL.createObjectURL(file)); setSaveError(''); }} /></label>{avatarPreview && <button type="button" onClick={()=>{ if (avatarFile) { setAvatarFile(null); setAvatarPreview(editingDoctor?.avatar_url || ''); setRemoveAvatar(false); } else { if (editingDoctor?.avatar_url && !window.confirm(`Gỡ ảnh đại diện của bác sĩ “${form.full_name}”? Thao tác chỉ hoàn tất khi lưu biểu mẫu.`)) return; setAvatarPreview(''); setRemoveAvatar(Boolean(editingDoctor?.avatar_url)); } }} className="text-sm text-rose-700">Bỏ ảnh</button>}</div>
            {[['full_name','Họ và tên','text'],['phone','Số điện thoại','tel'],['email','Email','email'],...(!editingDoctor ? [['password','Mật khẩu khởi tạo (12 ký tự trở lên)','password']] : []),['experience_years','Số năm kinh nghiệm','number']].map(([key,label,type]) => <label key={key} className="space-y-1 text-sm"><span>{label}</span><input required={['full_name','phone','email','password'].includes(key)} type={type} min={type==='number'?0:undefined} value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}
            <label className="space-y-1 text-sm"><span>Chuyên khoa</span><select value={form.specialty_id} onChange={(event)=>setForm({...form,specialty_id:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chưa phân công</option>{specialties.filter((item)=>item.is_active).map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span>Phòng khám</span><select value={form.room_id} onChange={(event)=>setForm({...form,room_id:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">Chưa phân công</option>{rooms.filter((item)=>item.is_active).map((item)=><option key={item.id} value={item.id}>{item.name} ({item.room_number})</option>)}</select></label>
            <label className="space-y-1 text-sm sm:col-span-2"><span>Giới thiệu</span><textarea value={form.bio} onChange={(event)=>setForm({...form,bio:event.target.value})} className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} /></label>
          </div>
          {editingDoctor && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingDoctor.doctor_active && editingDoctor.account_active} onChange={(event)=>setEditingDoctor({...editingDoctor, doctor_active:event.target.checked, account_active:event.target.checked})} /> Tài khoản đang hoạt động</label>}
          <div className="flex justify-end gap-2"><button type="button" disabled={isSaving} onClick={()=>{setShowCreate(false);setEditingDoctor(null);setAvatarFile(null);setAvatarPreview('');setRemoveAvatar(false);}} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Hủy</button><button disabled={isSaving} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isSaving ? 'Đang lưu…' : editingDoctor ? 'Lưu thay đổi' : 'Tạo bác sĩ'}</button></div>
        </form>
      </div>}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-800 text-base">Danh sách bác sĩ</h3>
          <div className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên bác sĩ hoặc chuyên khoa..."
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:inline-flex sm:w-auto">
          <button type="button" onClick={() => setDoctorTab('ACTIVE')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:px-4 ${doctorTab === 'ACTIVE' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đang hoạt động <span className="ml-1 rounded-full bg-teal-50 px-2 py-0.5 tabular-nums text-teal-800">{activeDoctors.length}</span>
          </button>
          <button type="button" onClick={() => setDoctorTab('INACTIVE')} className={`rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:px-4 ${doctorTab === 'INACTIVE' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            Đã ngừng hoạt động <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 tabular-nums text-slate-700">{inactiveDoctors.length}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full text-center py-8 text-slate-400 text-xs">Đang tải danh sách bác sĩ...</div>
          ) : visibleDoctors.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">{searchTerm.trim() ? 'Không tìm thấy bác sĩ phù hợp trong tab này.' : doctorTab === 'ACTIVE' ? 'Chưa có bác sĩ đang hoạt động.' : 'Chưa có bác sĩ đã ngừng hoạt động.'}</div>
          ) : (
            visibleDoctors.map((doc) => (
              <article key={doc.id} className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <ImageWithFallback src={doc.avatar_url} alt={doc.full_name} className="h-12 w-12 shrink-0 rounded-2xl object-cover" fallback={<span className="font-black text-lg">{doc.full_name?.charAt(0) || 'B'}</span>} />
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words font-semibold leading-5 text-slate-900">{doc.full_name}</h4>
                    <span className="mt-0.5 block break-words text-xs font-medium text-teal-800">{doc.specialty_name || 'Chưa phân chuyên khoa'}</span>
                  </div>
                  <span className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${doctorIsActive(doc) ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{doctorIsActive(doc) ? 'Đang hoạt động' : 'Đã ngừng'}</span>
                </div>

                <div className="mt-4 flex-1 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                  <div className="flex min-w-0 items-start gap-2">
                    <Building className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 break-words">Phòng: <strong className="font-medium text-slate-800">{doc.room_name || doc.room_number || 'Chưa phân công'}</strong></span>
                  </div>
                  <div className="flex min-w-0 items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 break-all">SĐT: {doc.phone || 'Chưa cập nhật'}</span>
                  </div>
                  <div className="flex min-w-0 items-start gap-2">
                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="min-w-0 break-all">Email: {doc.email || 'Chưa cập nhật'}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                  <button type="button" onClick={() => openEdit(doc)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" />Mở hồ sơ</button>
                  {doctorIsActive(doc) ? <button type="button" disabled={pendingDeactivateId === doc.id} onClick={() => deactivateDoctor(doc)} className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 disabled:opacity-50">{pendingDeactivateId === doc.id ? 'Đang xử lý…' : 'Ngừng hoạt động'}</button> : <button type="button" disabled={pendingActivateId === doc.id} onClick={() => reactivateDoctor(doc)} className="min-h-10 flex-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-100 disabled:opacity-50">{pendingActivateId === doc.id ? 'Đang xử lý…' : 'Kích hoạt lại'}</button>}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorMgmt;

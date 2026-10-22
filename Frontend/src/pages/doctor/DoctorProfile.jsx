import React, { useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import ImageWithFallback from '../../components/common/ImageWithFallback';

const DoctorProfile = () => {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', phone: '', email: '' });
  const [preview, setPreview] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await axiosClient.get('/doctors/me/profile');
      setProfile(result.data); setForm({ bio: result.data.bio || '', phone: result.data.phone || '', email: result.data.email || '' });
      setPreview(result.data.avatar_url || '');
    } catch (requestError) { setError(requestError.message || 'Không tải được hồ sơ bác sĩ.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      await axiosClient.patch('/doctors/me/profile', form);
      if (file) {
        const body = new FormData(); body.append('image', file);
        await axiosClient.post('/doctors/me/avatar', body);
      }
      await Promise.all([load(), refreshProfile()]);
      setFile(null); setNotice('Đã lưu hồ sơ. Chuyên khoa, phòng và phí khám do quản trị viên quản lý.');
    } catch (requestError) { setError(requestError.message || 'Không lưu được hồ sơ.'); }
    finally { setSaving(false); }
  };

  const removeAvatar = async () => {
    if (file) { setFile(null); setPreview(profile.avatar_url || ''); return; }
    setSaving(true); setError('');
    try { await axiosClient.delete('/doctors/me/avatar'); await Promise.all([load(), refreshProfile()]); setFile(null); }
    catch (requestError) { setError(requestError.message || 'Không bỏ được ảnh đại diện.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">Đang tải hồ sơ…</div>;
  if (!profile) return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error || 'Không tìm thấy hồ sơ.'}</div>;

  return <form onSubmit={save} className="mx-auto max-w-4xl space-y-5">
    <header><h1 className="text-2xl font-bold text-slate-900">Hồ sơ của tôi</h1><p className="mt-1 text-sm text-slate-500">Bạn có thể cập nhật ảnh, giới thiệu và thông tin liên hệ.</p></header>
    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-[180px_1fr]">
      <div className="space-y-3"><ImageWithFallback src={preview} alt={profile.full_name} className="mx-auto h-36 w-36 rounded-full object-cover" fallback={<span className="text-4xl font-bold">{profile.full_name?.charAt(0) || 'B'}</span>} />
        <label className="block cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium hover:bg-slate-50">{preview ? 'Thay ảnh' : 'Chọn ảnh'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const next = event.target.files?.[0]; if (!next) return; if (next.size > 5 * 1024 * 1024) { setError('Ảnh không được vượt quá 5 MB.'); return; } setFile(next); setPreview(URL.createObjectURL(next)); setError(''); }} /></label>
        {(preview || file) && <button type="button" disabled={saving} onClick={removeAvatar} className="w-full rounded-lg px-3 py-2 text-sm text-rose-700 hover:bg-rose-50">Bỏ ảnh đại diện</button>}
        <p className="text-center text-xs text-slate-500">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
      </div>
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-slate-500">Họ và tên</span><input readOnly value={profile.full_name || ''} className="w-full rounded-lg border bg-slate-50 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Chuyên khoa · quản trị viên cập nhật</span><input readOnly value={profile.specialty_name || 'Chưa phân công'} className="w-full rounded-lg border bg-slate-50 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Phòng · quản trị viên cập nhật</span><input readOnly value={profile.room_name ? `${profile.room_name}${profile.room_number ? ` (${profile.room_number})` : ''}` : 'Chưa phân công'} className="w-full rounded-lg border bg-slate-50 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Kinh nghiệm</span><input readOnly value={`${profile.experience_years || 0} năm`} className="w-full rounded-lg border bg-slate-50 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Phí khám · quản trị viên cập nhật</span><input readOnly value={`${Number(profile.consultation_fee || 0).toLocaleString('vi-VN')} ₫`} className="w-full rounded-lg border bg-slate-50 px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Điện thoại liên hệ</span><input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
        <label className="space-y-1 text-sm"><span className="text-slate-500">Email liên hệ</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="text-slate-500">Giới thiệu</span><textarea rows={5} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="w-full rounded-lg border px-3 py-2" /></label>
      </div>
    </section>
    <div className="flex justify-end"><button disabled={saving} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
  </form>;
};

export default DoctorProfile;

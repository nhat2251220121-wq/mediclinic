import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Save, UserRound } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';

const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const emptyForm = {
  full_name: '', phone: '', email: '', date_of_birth: '', gender: '', citizen_id: '',
  emergency_contact: '', job: '', insurance_code: '', address: ''
};

const fromProfile = (profile) => ({
  full_name: profile.full_name || '',
  phone: profile.phone || '',
  email: profile.email || '',
  date_of_birth: profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '',
  gender: profile.gender || '',
  citizen_id: profile.citizen_id || '',
  emergency_contact: profile.emergency_contact || '',
  job: profile.job || '',
  insurance_code: profile.insurance_code || '',
  address: profile.address || ''
});

const isValidPhone = (value) => {
  const digits = value.match(/\d/g) || [];
  return /^\+?[0-9 ()-]{8,20}$/.test(value) && digits.length >= 8 && digits.length <= 15;
};

const validate = (form) => {
  const errors = {};
  const fullName = form.full_name.trim();
  const phone = form.phone.trim();
  const citizenId = form.citizen_id.trim();
  const emergencyContact = form.emergency_contact.trim();
  if (!fullName) errors.full_name = 'Vui lòng nhập họ và tên.';
  else if (fullName.length > 150) errors.full_name = 'Họ và tên không được vượt quá 150 ký tự.';
  if (!isValidPhone(phone)) errors.phone = 'Nhập số điện thoại hợp lệ có từ 8 đến 15 chữ số.';
  if (!['MALE', 'FEMALE', 'OTHER'].includes(form.gender)) errors.gender = 'Vui lòng chọn giới tính.';
  if (form.date_of_birth) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(form.date_of_birth);
    const date = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (!match || !date || date.toISOString().slice(0, 10) !== form.date_of_birth || form.date_of_birth > clinicToday()) {
      errors.date_of_birth = 'Ngày sinh không hợp lệ hoặc nằm trong tương lai.';
    }
  }
  if (citizenId && !/^\d{9}$|^\d{12}$/.test(citizenId)) errors.citizen_id = 'Nhập CMND gồm 9 số hoặc CCCD gồm 12 số.';
  if (emergencyContact && !isValidPhone(emergencyContact)) errors.emergency_contact = 'Nhập số liên hệ khẩn cấp hợp lệ.';
  if (form.insurance_code.trim().length > 50) errors.insurance_code = 'Mã BHYT không được vượt quá 50 ký tự.';
  if (form.job.trim().length > 100) errors.job = 'Nghề nghiệp không được vượt quá 100 ký tự.';
  if (form.address.trim().length > 255) errors.address = 'Địa chỉ không được vượt quá 255 ký tự.';
  return errors;
};

const ProfileField = ({ label, error, children }) => <label className="block min-w-0 text-sm font-medium text-slate-700"><span>{label}</span>{children}{error && <span className="mt-1 block text-xs font-normal text-rose-700" role="alert">{error}</span>}</label>;

const PatientProfile = () => {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let current = true;
    setLoading(true);
    axiosClient.get('/auth/profile')
      .then((result) => {
        const profile = result.data;
        if (!current) return;
        if (!result.success || !profile || Number(profile.id) !== Number(user?.id) || profile.role !== 'PATIENT') {
          throw new Error('Không tải được hồ sơ của tài khoản đang đăng nhập.');
        }
        setForm(fromProfile(profile));
        setProfileLoaded(true);
      })
      .catch((error) => { if (current) setMessage({ type: 'error', text: error.message || 'Không tải được hồ sơ.' }); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setMessage(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const saved = await updateProfile({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        date_of_birth: form.date_of_birth || null,
        citizen_id: form.citizen_id.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        job: form.job.trim() || null,
        insurance_code: form.insurance_code.trim() || null,
        address: form.address.trim() || null
      });
      if (Number(saved.id) !== Number(user?.id) || saved.role !== 'PATIENT') throw new Error('Không thể xác nhận hồ sơ tài khoản hiện tại.');
      setForm(fromProfile(saved));
      setMessage({ type: 'success', text: 'Đã lưu thay đổi hồ sơ.' });
    } catch (error) {
      if (error.fieldErrors) setErrors((current) => ({ ...current, ...error.fieldErrors }));
      setMessage({ type: 'error', text: error.message || 'Không lưu được hồ sơ. Vui lòng thử lại.' });
    } finally { setSaving(false); }
  };

  const inputClass = (name) => `mt-1 w-full min-w-0 rounded-xl border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 ${errors[name] ? 'border-rose-400' : 'border-slate-200'}`;

  return <section className="mx-auto w-full max-w-4xl space-y-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800"><UserRound className="h-5 w-5" /></span><div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Hồ sơ cá nhân</h1><p className="mt-1 text-sm text-slate-500">Xem và cập nhật thông tin của tài khoản bệnh nhân đang đăng nhập.</p></div></div>
    </header>

    {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${message.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
      {message.type === 'error' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}{message.text}
    </div>}

    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải hồ sơ…</p> : !profileLoaded ? <p className="py-8 text-center text-sm text-slate-500">Không hiển thị biểu mẫu khi chưa tải được hồ sơ tài khoản.</p> : <>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <ProfileField label="Họ và tên *" error={errors.full_name}><input name="full_name" autoComplete="name" maxLength={150} value={form.full_name} onChange={handleChange} className={inputClass('full_name')} /></ProfileField>
          <ProfileField label="Email tài khoản · chỉ đọc"><input name="email" type="email" value={form.email} readOnly className="mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600" /><span className="mt-1 block text-xs font-normal text-slate-500">Muốn đổi email cần có luồng xác thực email mới.</span></ProfileField>
          <ProfileField label="Số điện thoại *" error={errors.phone}><input name="phone" type="tel" autoComplete="tel" maxLength={20} value={form.phone} onChange={handleChange} className={inputClass('phone')} /></ProfileField>
          <ProfileField label="Ngày sinh" error={errors.date_of_birth}><input name="date_of_birth" type="date" max={clinicToday()} value={form.date_of_birth} onChange={handleChange} className={inputClass('date_of_birth')} /></ProfileField>
          <ProfileField label="Giới tính *" error={errors.gender}><select name="gender" value={form.gender} onChange={handleChange} className={inputClass('gender')}><option value="">Chọn giới tính</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></ProfileField>
          <ProfileField label="CCCD/CMND" error={errors.citizen_id}><input name="citizen_id" inputMode="numeric" maxLength={12} value={form.citizen_id} onChange={handleChange} className={inputClass('citizen_id')} placeholder="9 số CMND hoặc 12 số CCCD" /></ProfileField>
          <ProfileField label="Số liên hệ khẩn cấp" error={errors.emergency_contact}><input name="emergency_contact" type="tel" maxLength={20} value={form.emergency_contact} onChange={handleChange} className={inputClass('emergency_contact')} /></ProfileField>
          <ProfileField label="Mã BHYT" error={errors.insurance_code}><input name="insurance_code" maxLength={50} value={form.insurance_code} onChange={handleChange} className={inputClass('insurance_code')} /></ProfileField>
          <ProfileField label="Nghề nghiệp" error={errors.job}><input name="job" maxLength={100} value={form.job} onChange={handleChange} className={inputClass('job')} /></ProfileField>
          <ProfileField label="Địa chỉ" error={errors.address}><input name="address" autoComplete="street-address" maxLength={255} value={form.address} onChange={handleChange} className={inputClass('address')} /></ProfileField>
        </div>
        <div className="flex justify-end border-t border-slate-100 pt-4"><button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 disabled:cursor-wait disabled:opacity-60 sm:w-auto"><Save className="h-4 w-4" />{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </>}
    </form>
  </section>;
};

export default PatientProfile;

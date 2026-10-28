import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import { useAuth } from '../../context/AuthContext';
import PaymentModal from '../../components/common/PaymentModal';
import { Calendar, Clock, User, Stethoscope, AlertTriangle, CheckCircle2, ArrowLeft, CreditCard, ShieldCheck, ChevronRight, QrCode, Banknote, Loader2, Save, Edit3, Check } from 'lucide-react';
import AIChatWidget from '../../components/common/AIChatWidget';

const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const generate14Days = () => {
  const days = [];
  const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const clinicDate = new Date(`${clinicToday()}T00:00:00Z`);
  for (let i = 0; i < 14; i++) {
    const d = new Date(clinicDate);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    days.push({
      label: dayNames[d.getUTCDay()],
      date: `${yyyy}-${mm}-${dd}`,
      display: `${dd}/${mm}/${yyyy}`
    });
  }
  return days;
};

const Booking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [services, setServices] = useState([]);
  const [clinicDoctors, setClinicDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [doctorError, setDoctorError] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const suggestedSpecialty = location.state?.suggestedSpecialty || '';
  const [bookingSymptoms, setBookingSymptoms] = useState(location.state?.initialSymptoms || '');
  const requestedServiceId = new URLSearchParams(location.search).get('service_id') || location.state?.selectedService?.id;
  const [selectedServiceId, setSelectedServiceId] = useState(requestedServiceId ? String(requestedServiceId) : '');
  const passedService = services.find((service) => Number(service.id) === Number(selectedServiceId)) || null;

  const [step, setStep] = useState(1); // 1: Điền thông tin, 2: Chọn phương thức & thanh toán, 3: Thành công
  const [isEditingInfo, setIsEditingInfo] = useState(true);
  const [infoSavedSuccess, setInfoSavedSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const dirtyProfileFields = useRef(new Set());

  const handleSavePatientInfo = async (e) => {
    e?.preventDefault();
    setProfileError('');
    setInfoSavedSuccess(false);
    try {
      const saved = await updateProfile({ full_name: patientInfo.fullName, phone: patientInfo.phoneNumber,
        date_of_birth: patientInfo.dob || null, gender: patientInfo.gender, citizen_id: patientInfo.citizenId || null,
        insurance_code: patientInfo.insuranceCode || null, emergency_contact: patientInfo.emergencyContact || null,
        job: patientInfo.job || null, address: patientInfo.address || null });
      setPatientInfo({ fullName: saved.full_name || '', phoneNumber: saved.phone || '',
        dob: saved.date_of_birth ? String(saved.date_of_birth).slice(0, 10) : '', gender: saved.gender || 'OTHER',
        citizenId: saved.citizen_id || '', emergencyContact: saved.emergency_contact || '', job: saved.job || '',
        insuranceCode: saved.insurance_code || '', address: saved.address || '' });
      dirtyProfileFields.current.clear();
      setInfoSavedSuccess(true);
    } catch (error) { setProfileError(error.message || 'Không lưu được hồ sơ.'); }
  };


  const [patientInfo, setPatientInfo] = useState({
    fullName: '', phoneNumber: '', dob: '', gender: 'OTHER', job: '', citizenId: '',
    insuranceCode: '', emergencyContact: '', address: ''
  });

  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(clinicToday);
  const [selectedSlot, setSelectedSlot] = useState('');

  // State đặt lịch & thanh toán
  const [createdAppointmentId, setCreatedAppointmentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentMethodChoice, setPaymentMethodChoice] = useState('VIETQR'); // 'VIETQR' | 'CASH'

  const selectedDoctor = clinicDoctors.find(d => Number(d.id) === Number(selectedDoctorId));
  const selectedSlotDetails = availableSlots.find((slot) => String(slot.slot_id) === String(selectedSlot));
  const weekDays = useMemo(() => generate14Days(), []);

  const updatePatientField = (field, value) => {
    dirtyProfileFields.current.add(field);
    setInfoSavedSuccess(false);
    setPatientInfo((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    dirtyProfileFields.current = new Set();
    setPatientInfo({ fullName: '', phoneNumber: '', dob: '', gender: 'OTHER', job: '', citizenId: '', insuranceCode: '', emergencyContact: '', address: '' });
    setProfileLoading(true);
    setProfileError('');
    axiosClient.get('/auth/profile')
      .then((result) => {
        const profile = result.data;
        if (!active || !result.success || !profile || Number(profile.id) !== Number(user.id)) return;
        const values = {
          fullName: profile.full_name || '',
          phoneNumber: profile.phone || '',
          dob: profile.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '',
          gender: profile.gender || 'OTHER',
          citizenId: profile.citizen_id || '',
          emergencyContact: profile.emergency_contact || '',
          job: profile.job || '',
          insuranceCode: profile.insurance_code || '',
          address: profile.address || ''
        };
        setPatientInfo((current) => Object.fromEntries(Object.entries(values).map(([field, value]) =>
          [field, dirtyProfileFields.current.has(field) ? current[field] : value])));
      })
      .catch((error) => {
        if (active) setProfileError(error.message || 'Không tải được hồ sơ tài khoản hiện tại.');
      })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (requestedServiceId) setSelectedServiceId(String(requestedServiceId));
  }, [location.search, location.state?.selectedService?.id]);

  useEffect(() => {
    let active = true;
    axiosClient.get('/doctors/services')
      .then((result) => {
        if (!active) return;
        const rows = result.data || [];
        setServices(rows);
        setSelectedServiceId((current) => rows.some((service) => String(service.id) === String(current)) ? current : String(rows[0]?.id || ''));
      })
      .catch(() => { if (active) setCatalogError('Không tải được danh sách dịch vụ. Vui lòng thử lại.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!passedService?.specialty_id) {
      setDoctorsLoading(false);
      setDoctorError('');
      setClinicDoctors([]);
      setSelectedDoctorId('');
      setAvailableSlots([]);
      setSelectedSlot('');
      return undefined;
    }
    let active = true;
    setDoctorError('');
    setClinicDoctors([]);
    setSelectedDoctorId('');
    setAvailableSlots([]);
    setSelectedSlot('');
    setDoctorsLoading(true);
    axiosClient.get(`/doctors?specialty_id=${encodeURIComponent(passedService.specialty_id)}`)
      .then((result) => {
        if (!active) return;
        const doctors = result.data || [];
        setClinicDoctors(doctors);
        const suggested = doctors.find((doctor) => doctor.specialty_name?.toLocaleLowerCase('vi') === suggestedSpecialty.toLocaleLowerCase('vi'));
        if (suggested || doctors[0]) setSelectedDoctorId(String((suggested || doctors[0]).id));
      })
      .catch(() => { if (active) setDoctorError('Không tải được bác sĩ thuộc chuyên khoa của dịch vụ. Vui lòng thử lại.'); })
      .finally(() => { if (active) setDoctorsLoading(false); });
    return () => { active = false; };
  }, [passedService?.id, passedService?.specialty_id, suggestedSpecialty]);

  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) { setAvailableSlots([]); setSelectedSlot(''); return undefined; }
    let active = true;
    setSlotsLoading(true);
    axiosClient.get(`/doctors/availability/slots?doctor_id=${selectedDoctorId}&date=${selectedDate}`)
      .then((result) => { if (active) { setAvailableSlots(result.data || []); setSelectedSlot(''); } })
      .catch(() => { if (active) { setAvailableSlots([]); setCatalogError('Không tải được khung giờ đang trống.'); } })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [selectedDoctorId, selectedDate]);

  // Bước 1 -> Bước 2
  const handleNextToPayment = (e) => {
    e.preventDefault();
    if (!passedService || !selectedDoctor || !selectedSlotDetails || !patientInfo.fullName.trim() || !patientInfo.phoneNumber.trim()) {
      setProfileError('Vui lòng chọn dịch vụ, bác sĩ, khung giờ và nhập đủ họ tên, số điện thoại.');
      return;
    }
    setProfileError('');
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleServiceChange = (event) => {
    const serviceId = event.target.value;
    setSelectedServiceId(serviceId);
    navigate(`${location.pathname}?service_id=${encodeURIComponent(serviceId)}`, { replace: true, state: location.state });
    setSelectedDoctorId('');
    setSelectedDate(clinicToday());
    setSelectedSlot('');
    setAvailableSlots([]);
    setCatalogError('');
    setDoctorError('');
  };

  // Tạo lịch hẹn trên database & mở Thanh Toán VietQR / Tiền mặt
  const handleCreateAppointmentAndPay = async (payMethod) => {
    setIsSubmitting(true);
    try {
      // 1. Gửi request tạo lịch hẹn lên backend API
      const res = await axiosClient.post('/appointments', {
        doctor_id: Number(selectedDoctorId),
        service_id: passedService?.id,
        slot_id: Number(selectedSlot),
        appointment_date: selectedDate,
        initial_symptoms: bookingSymptoms.trim() || `Khám dịch vụ ${passedService?.name || ''}`,
        ai_predicted_specialty: suggestedSpecialty || null,
        full_name: patientInfo.fullName, phone_number: patientInfo.phoneNumber, dob: patientInfo.dob || null,
        gender: patientInfo.gender, address: patientInfo.address || null, citizen_id: patientInfo.citizenId || null,
        insurance_code: patientInfo.insuranceCode || null,
        notes: `Liên hệ khẩn cấp: ${patientInfo.emergencyContact || 'Chưa cung cấp'}`
      });

      if (res.success) {
        const appObj = res.data;
        const newAppId = appObj.id || appObj.appointment_id;
        setCreatedAppointmentId(newAppId);
        setPaymentConfirmed(false);

        if (payMethod === 'VIETQR') {
          // Mở Modal VietQR SePay
          setIsPaymentModalOpen(true);
        } else {
          // Tiền mặt tại quầy -> Chuyển thẳng sang bước hoàn tất
          setStep(3);
        }
      }
    } catch (err) {
      alert('Lỗi đặt lịch hẹn: ' + (err.message || 'Khung giờ này có thể đã được đặt'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* ======================================================== */}
      {/* BƯỚC 1: ĐẶT LỊCH KHÁM                                     */}
      {/* ======================================================== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Đặt lịch khám bệnh</h2>
            <p className="text-xs text-slate-500 mt-1">Hệ thống Y tế thông minh MediClinic</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Lưu ý khi đặt lịch khám:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
              <li>Kiểm tra kỹ thông tin dịch vụ, thông tin người khám, bác sĩ phụ trách và giờ khám mong muốn trước khi thanh toán.</li>
              <li>Bạn có thể thay đổi thông tin người khám nếu đặt hộ người thân.</li>
              <li>Có thể lựa chọn thanh toán **VietQR tự động** hoặc **Tiền mặt tại quầy**.</li>
            </ol>
          </div>

          {/* Thông tin dịch vụ */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Thông tin dịch vụ</span>
            <div>
              <label htmlFor="booking-service" className="mb-1 block text-xs font-semibold text-slate-600">Dịch vụ khám</label>
              <select id="booking-service" value={passedService?.id || ''} onChange={handleServiceChange} disabled={!services.length}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm">
                {!services.length && <option value="">{catalogError || 'Đang tải dịch vụ...'}</option>}
                {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {Number(service.price || 0).toLocaleString('vi-VN')} ₫</option>)}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <ImageWithFallback src={passedService?.image_url} alt={passedService?.name || 'Ảnh dịch vụ'} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 flex-shrink-0" fallback={<Stethoscope className="w-7 h-7" />} />
              <div className="space-y-1 flex-1">
                <h4 className="font-bold text-slate-800 text-base">{passedService?.name || 'Chưa chọn dịch vụ'}</h4>
                <div className="text-sm font-black text-emerald-600">Phí khám: {Number(passedService?.price || 0).toLocaleString('vi-VN')} ₫</div>
                <p className="text-xs text-slate-500">{passedService?.description}</p>
              </div>
            </div>
            {passedService && !passedService.specialty_id && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Dịch vụ này chưa được gán chuyên khoa nên chưa thể đặt lịch. Vui lòng báo quản trị viên gán chuyên khoa.</p>}
          </div>

          {suggestedSpecialty && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
              Gợi ý chuyên khoa từ trợ lý: <strong>{suggestedSpecialty}</strong>. Hãy kiểm tra và chọn bác sĩ phù hợp bên dưới.
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label htmlFor="booking-symptoms" className="mb-2 block text-sm font-semibold text-slate-700">Triệu chứng hoặc lý do khám</label>
            <textarea id="booking-symptoms" rows={3} maxLength={2000} value={bookingSymptoms}
              onChange={(event) => setBookingSymptoms(event.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder="Mô tả ngắn gọn để nhân viên y tế chuẩn bị tiếp nhận" />
          </div>

          {/* Thông tin người khám */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-sky-700">Thông tin người khám</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-slate-500">{profileLoading ? 'Đang tải hồ sơ tài khoản...' : 'Thông tin hồ sơ tài khoản hiện tại'}</span>
                <button
                  type="button"
                  onClick={() => setIsEditingInfo(!isEditingInfo)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-sky-600" />
                  <span>{isEditingInfo ? 'Khóa thông tin' : 'Chỉnh sửa thông tin'}</span>
                </button>
              </div>
            </div>

            {/* Thông báo đã lưu thành công */}
            {infoSavedSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-sm">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Đã lưu và cập nhật thông tin người khám thành công!</span>
              </div>
            )}
            {profileError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{profileError}</div>}

            {/* Grid 3 hàng 3 cột cân đối chuẩn đẹp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Hàng 1 */}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Số điện thoại</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.phoneNumber}
                  onChange={(e) => updatePatientField('phoneNumber', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Họ và tên</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.fullName}
                  onChange={(e) => updatePatientField('fullName', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border font-bold transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-700 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Ngày sinh</label>
                <input
                  type="date"
                  disabled={!isEditingInfo}
                  value={patientInfo.dob}
                  onChange={(e) => updatePatientField('dob', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Hàng 2 */}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">* Giới tính</label>
                <select
                  disabled={!isEditingInfo}
                  value={patientInfo.gender}
                  onChange={(e) => updatePatientField('gender', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác / chưa xác định</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">CCCD / CMND</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.citizenId}
                  onChange={(e) => updatePatientField('citizenId', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">SĐT liên hệ khẩn cấp</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.emergencyContact}
                  onChange={(e) => updatePatientField('emergencyContact', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              {/* Hàng 3 */}
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Nghề nghiệp</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.job}
                  onChange={(e) => updatePatientField('job', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Mã thẻ BHYT</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.insuranceCode}
                  onChange={(e) => updatePatientField('insuranceCode', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">Địa chỉ thường trú</label>
                <input
                  type="text"
                  disabled={!isEditingInfo}
                  value={patientInfo.address}
                  onChange={(e) => updatePatientField('address', e.target.value)}
                  className={`w-full p-2.5 rounded-xl border transition ${
                    isEditingInfo
                      ? 'bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-sky-500 text-slate-800'
                      : 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  }`}
                />
              </div>
            </div>

            {/* Thanh thao tác nút Lưu thông tin người khám */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 italic">
                * Nhấn nút "Lưu thông tin" sau khi cập nhật để lưu hồ sơ người khám.
              </span>
              <button
                type="button"
                onClick={handleSavePatientInfo}
                className="w-full sm:w-auto px-6 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thông tin người khám</span>
              </button>
            </div>
          </div>

          {/* Chọn bác sĩ & thời gian khám */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
              Chọn bác sĩ phụ trách và thời gian khám
            </span>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                    <th className="p-3 w-10">Chọn</th>
                    <th className="p-3">Bác sĩ phụ trách</th>
                    <th className="p-3">Chuyên khoa</th>
                    <th className="p-3">Phòng khám</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!clinicDoctors.length && <tr><td colSpan="4" className="p-4 text-center text-slate-500">{doctorsLoading ? 'Đang tải bác sĩ thuộc chuyên khoa...' : doctorError || (!passedService?.specialty_id ? 'Dịch vụ chưa được gán chuyên khoa.' : 'Chưa có bác sĩ đang hoạt động thuộc chuyên khoa của dịch vụ.')}</td></tr>}
                  {clinicDoctors.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(String(doc.id))}
                      className={`cursor-pointer transition ${
                        Number(selectedDoctorId) === Number(doc.id) ? 'bg-sky-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="radio"
                          name="doctorRadio"
                          checked={Number(selectedDoctorId) === Number(doc.id)}
                          onChange={() => setSelectedDoctorId(String(doc.id))}
                          className="text-sky-600"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        <span className="flex items-center gap-2"><ImageWithFallback src={doc.avatar_url} alt={doc.full_name} className="h-9 w-9 rounded-full object-cover" fallback={<span className="font-bold">{doc.full_name?.charAt(0) || 'B'}</span>} />{doc.full_name}</span>
                      </td>
                      <td className="p-3 text-teal-700">{doc.specialty_name}</td>
                      <td className="p-3 text-slate-600">{doc.room_name || doc.room_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ngày khám */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Ngày khám:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {weekDays.map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelectedDate(d.date)}
                    className={`p-3 rounded-2xl border text-xs font-bold text-center transition ${
                      selectedDate === d.date
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>{d.label}</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{d.display}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Giờ khám */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Giờ khám:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {slotsLoading && <p className="text-xs text-slate-500">Đang kiểm tra ca làm việc…</p>}
                {!slotsLoading && availableSlots.length === 0 && <p className="text-xs text-slate-500">Bác sĩ chưa mở ca hoặc các ca đã được đặt trong ngày này.</p>}
                {availableSlots.map((slot) => (
                  <button
                    key={slot.slot_id}
                    type="button"
                    onClick={() => setSelectedSlot(String(slot.slot_id))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      selectedSlot === String(slot.slot_id)
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slot.time_slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNextToPayment}
              className="px-8 py-3.5 bg-sky-700 text-white font-semibold rounded-2xl shadow-md hover:bg-sky-800 transition-colors flex items-center gap-2"
            >
              <span>Xác nhận & Chọn Thanh toán</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 2: CHỌN HÌNH THỨC THANH TOÁN (VIETQR / TIỀN MẶT)      */}
      {/* ======================================================== */}
      {step === 2 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại bước trước</span>
          </button>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán dịch vụ khám</h2>

            {/* Chi tiết đơn */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Dịch vụ:</span>
                <strong className="text-slate-800 text-sm">{passedService?.name}</strong>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Bác sĩ phụ trách:</span>
                <strong className="text-slate-800">{selectedDoctor?.full_name} ({selectedDoctor?.room_name || selectedDoctor?.room_number || 'Phòng khám'})</strong>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Thời gian khám:</span>
                <strong className="text-slate-800">{selectedDate} ({selectedSlotDetails?.time_slot})</strong>
              </div>
              <div className="flex justify-between items-center text-base pt-1">
                <span className="font-bold text-slate-700">Tổng tiền cần thanh toán:</span>
                <span className="font-black text-2xl text-emerald-600">{Number(passedService?.price || 0).toLocaleString('vi-VN')} ₫</span>
              </div>
            </div>

            {/* Chọn 2 hình thức thanh toán */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Chọn hình thức thanh toán:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lựa chọn 1: VietQR SePay */}
                <div
                  onClick={() => setPaymentMethodChoice('VIETQR')}
                  className={`p-5 rounded-3xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    paymentMethodChoice === 'VIETQR'
                      ? 'border-sky-600 bg-sky-50/50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-2xl flex items-center justify-center">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <input
                      type="radio"
                      name="payChoice"
                      checked={paymentMethodChoice === 'VIETQR'}
                      onChange={() => setPaymentMethodChoice('VIETQR')}
                      className="text-sky-600"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Chuyển khoản VietQR Tự Động</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Quét mã VietQR bằng App Ngân hàng bất kỳ. Hệ thống tự động xác nhận qua SePay Webhook ngay lập tức.
                    </p>
                  </div>
                </div>

                {/* Lựa chọn 2: Tiền mặt */}
                <div
                  onClick={() => setPaymentMethodChoice('CASH')}
                  className={`p-5 rounded-3xl border-2 cursor-pointer transition flex flex-col justify-between space-y-3 ${
                    paymentMethodChoice === 'CASH'
                      ? 'border-emerald-600 bg-emerald-50/50 shadow-md'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Banknote className="w-6 h-6" />
                    </div>
                    <input
                      type="radio"
                      name="payChoice"
                      checked={paymentMethodChoice === 'CASH'}
                      onChange={() => setPaymentMethodChoice('CASH')}
                      className="text-emerald-600"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Tiền Mặt Tại Quầy Tiếp Đón</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Đặt trước lịch hẹn và thanh toán tiền mặt trực tiếp cho Thu ngân khi đến phòng khám.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Nút hành động */}
            <button
              onClick={() => handleCreateAppointmentAndPay(paymentMethodChoice)}
              disabled={isSubmitting}
              className={`w-full py-4 text-white font-black text-sm rounded-2xl shadow-xl transition flex items-center justify-center gap-2 ${
                paymentMethodChoice === 'VIETQR'
                  ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang khởi tạo lịch hẹn & thanh toán...</span>
                </>
              ) : paymentMethodChoice === 'VIETQR' ? (
                <>
                  <QrCode className="w-5 h-5" />
                  <span>Mở Mã VietQR Chuyển Khoản</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Xác Nhận Đặt Lịch & Thanh Toán Tiền Mặt</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 3: HOÀN TẤT ĐẶT LỊCH                                 */}
      {/* ======================================================== */}
      {step === 3 && (
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-200 space-y-5 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Đặt lịch hẹn thành công!</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Mã lịch hẹn của bạn là <strong className="text-sky-600">#{createdAppointmentId}</strong>. Bạn đã lựa chọn hình thức{' '}
            <strong className="text-slate-800">{paymentMethodChoice === 'VIETQR' ? 'Chuyển khoản VietQR' : 'Tiền mặt tại quầy'}</strong>.
          </p>
            <div role="status" className={`rounded-xl p-3 text-sm font-semibold ${paymentConfirmed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
              {paymentConfirmed ? 'Thanh toán đã được máy chủ xác nhận.' : paymentMethodChoice === 'CASH' ? 'Chưa thu tiền. Vui lòng thanh toán tại quầy; đặt lịch thành công không đồng nghĩa hóa đơn đã thanh toán.' : 'Đặt lịch thành công. Trạng thái thanh toán cần được xác nhận riêng từ máy chủ.'}
            </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-left space-y-1.5">
            <div>Bệnh nhân: <strong>{patientInfo.fullName}</strong></div>
            <div>Bác sĩ: <strong>{selectedDoctor?.full_name}</strong></div>
            <div>Thời gian: <strong>{selectedDate} | {selectedSlotDetails?.time_slot}</strong></div>
            <div>Số tiền: <strong className="text-emerald-600">{Number(passedService?.price || 0).toLocaleString('vi-VN')} ₫</strong></div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/patient/history')}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-sky-600/30"
            >
              Xem Lịch sử khám & Hóa đơn
            </button>
          </div>
        </div>
      )}

      {/* Modal VietQR SePay */}
      {createdAppointmentId && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
              setStep(3); // Thành công đặt lịch; trạng thái thanh toán được hiển thị riêng.
          }}
          appointmentId={createdAppointmentId}
          patientName={patientInfo.fullName}
          amount={passedService?.price}
          onSuccess={() => {
              setPaymentConfirmed(true);
            setIsPaymentModalOpen(false);
            setStep(3);
          }}
        />
      )}
    </div>
  );
};

export default Booking;

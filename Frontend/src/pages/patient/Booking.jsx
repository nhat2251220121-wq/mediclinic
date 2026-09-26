import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { Calendar, Clock, User, Stethoscope, AlertTriangle, CheckCircle2, ArrowLeft, CreditCard, ShieldCheck, ChevronRight } from 'lucide-react';
import AIChatWidget from '../../components/common/AIChatWidget';

const clinicDoctors = [
  {
    id: 1,
    name: 'BS. CKII Nguyễn Văn An',
    specialty: 'Khám Nội tổng quát',
    room: 'Phòng Khám Nội - Tầng 1 (P.101)',
    email: 'doctor.an@mediclinic.com',
    dob: '12/05/1980',
    avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 2,
    name: 'BS. CKI Trần Thị Bình',
    specialty: 'Khám Ngoại & Tim mạch',
    room: 'Phòng Khám Ngoại - Tầng 1 (P.102)',
    email: 'doctor.binh@mediclinic.com',
    dob: '20/08/1985',
    avatar: 'https://images.unsplash.com/photo-1594824813583-82f5b61e2715?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 3,
    name: 'ThS. BS Lê Đức Thái',
    specialty: 'Khám Da liễu',
    room: 'Phòng Da Liễu - Tầng 2 (P.201)',
    email: 'doctor.thai@mediclinic.com',
    dob: '10/03/1988',
    avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&auto=format&fit=crop&q=80'
  },
  {
    id: 4,
    name: 'BS. Đào Phan Quốc Hoài',
    specialty: 'Khám Răng - Hàm - Mặt',
    room: 'Phòng Răng Hàm Mặt - Tầng 2 (P.202)',
    email: 'doctor.hoai@mediclinic.com',
    dob: '15/01/1990',
    avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=100&auto=format&fit=crop&q=80'
  }
];

const availableTimeSlots = [
  '07:30 - 08:00',
  '08:00 - 08:30',
  '08:30 - 09:00',
  '09:00 - 09:30',
  '09:30 - 10:00',
  '10:00 - 10:30',
  '10:30 - 11:00',
  '13:30 - 14:00',
  '14:00 - 14:30',
  '14:30 - 15:00',
  '15:00 - 15:30',
  '15:30 - 16:00'
];

const Booking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dịch vụ truyền từ trang chủ hoặc mặc định
  const passedService = location.state?.selectedService || {
    id: 1,
    name: 'Khám Nội tổng quát',
    price: 300000,
    description: 'Kiểm tra sức khỏe định kỳ, tư vấn điều trị toàn diện các bệnh lý nội khoa.'
  };

  const [step, setStep] = useState(1); // 1: Điền thông tin & chọn lịch, 2: Xác nhận & VNPay Checkout, 3: VNPay Gateway, 4: Thành công
  const [isBookingForOther, setIsBookingForOther] = useState(false);

  // Form người khám (Hình 3.15)
  const [patientInfo, setPatientInfo] = useState({
    fullName: user?.full_name || 'Nguyễn Văn Nghĩa',
    phoneNumber: user?.phone || '0912325678',
    dob: '1990-05-20',
    gender: 'MALE',
    job: 'Kinh doanh',
    citizenId: '126456789',
    insuranceCode: 'INS987654',
    emergencyContact: '0987654521',
    address: '123 Nguyễn Trãi, Quận 1, TP.HCM'
  });

  // Chọn Bác sĩ & Thời gian
  const [selectedDoctorId, setSelectedDoctorId] = useState(1);
  const [selectedDate, setSelectedDate] = useState('2025-11-04');
  const [selectedSlot, setSelectedSlot] = useState('08:00 - 08:30');

  // VNPay Sandbox state
  const [vnpayMethod, setVnpayMethod] = useState('NCB');
  const [vnpayOtp, setVnpayOtp] = useState('123456');
  const [vnpayProcessing, setVnpayProcessing] = useState(false);

  const selectedDoctor = clinicDoctors.find(d => d.id === selectedDoctorId) || clinicDoctors[0];

  // Danh sách các ngày trong tuần (Hình 3.15)
  const weekDays = [
    { label: 'Thứ hai', date: '2025-11-04' },
    { label: 'Thứ ba', date: '2025-11-05' },
    { label: 'Thứ tư', date: '2025-11-06' },
    { label: 'Thứ năm', date: '2025-11-07' },
    { label: 'Thứ sáu', date: '2025-11-08' },
    { label: 'Thứ bảy', date: '2025-11-09' },
    { label: 'Chủ nhật', date: '2025-11-10' },
  ];

  const handleNextToPayment = (e) => {
    e.preventDefault();
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVnpaySubmit = () => {
    setVnpayProcessing(true);
    setTimeout(() => {
      setVnpayProcessing(false);
      setStep(4); // Thành công
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* ======================================================== */}
      {/* BƯỚC 1: ĐẶT LỊCH KHÁM (HÌNH 3.15)                         */}
      {/* ======================================================== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Đặt lịch khám bệnh</h2>
            <p className="text-xs text-slate-500 mt-1">Hệ thống Y tế thông minh MediClinic</p>
          </div>

          {/* Lưu ý khi đặt lịch khám (Hình 3.15) */}
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Lưu ý khi đặt lịch khám:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
              <li>Kiểm tra kỹ thông tin dịch vụ, thông tin người khám, bác sĩ phụ trách và giờ khám mong muốn trước khi thanh toán.</li>
              <li>Bạn có thể thay đổi thông tin người khám nếu đặt hộ người thân.</li>
              <li>Nếu muốn chỉnh sửa thông tin bạn có thể nhấn nút Quay lại ở góc trên bên trái.</li>
            </ol>
          </div>

          {/* Thông tin dịch vụ (Hình 3.15) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Thông tin dịch vụ</span>
            <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="w-14 h-14 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 flex-shrink-0">
                <Stethoscope className="w-7 h-7" />
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-bold text-slate-800 text-base">{passedService.name}</h4>
                <div className="text-sm font-black text-emerald-600">Phí khám: {passedService.price.toLocaleString()} đ</div>
                <p className="text-xs text-slate-500">{passedService.description}</p>
              </div>
            </div>
          </div>

          {/* Thông tin người khám (Hình 3.15) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">Thông tin người khám</span>
              <label className="flex items-center gap-2 text-xs text-sky-700 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBookingForOther}
                  onChange={(e) => setIsBookingForOther(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Thay đổi thông tin nếu bạn đặt hộ người thân</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-500 block mb-1">* Số điện thoại</label>
                <input
                  type="text"
                  value={patientInfo.phoneNumber}
                  onChange={(e) => setPatientInfo({ ...patientInfo, phoneNumber: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">* Họ và tên</label>
                <input
                  type="text"
                  value={patientInfo.fullName}
                  onChange={(e) => setPatientInfo({ ...patientInfo, fullName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">* Ngày sinh</label>
                <input
                  type="date"
                  value={patientInfo.dob}
                  onChange={(e) => setPatientInfo({ ...patientInfo, dob: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">* Giới tính</label>
                <select
                  value={patientInfo.gender}
                  onChange={(e) => setPatientInfo({ ...patientInfo, gender: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Nghề nghiệp</label>
                <input
                  type="text"
                  value={patientInfo.job}
                  onChange={(e) => setPatientInfo({ ...patientInfo, job: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Mã thẻ BHYT</label>
                <input
                  type="text"
                  value={patientInfo.insuranceCode}
                  onChange={(e) => setPatientInfo({ ...patientInfo, insuranceCode: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">CCCD / CMND</label>
                <input
                  type="text"
                  value={patientInfo.citizenId}
                  onChange={(e) => setPatientInfo({ ...patientInfo, citizenId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">SĐT liên hệ khẩn cấp</label>
                <input
                  type="text"
                  value={patientInfo.emergencyContact}
                  onChange={(e) => setPatientInfo({ ...patientInfo, emergencyContact: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 block mb-1">Địa chỉ thường trú</label>
                <input
                  type="text"
                  value={patientInfo.address}
                  onChange={(e) => setPatientInfo({ ...patientInfo, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Chọn bác sĩ phụ trách và thời gian khám (Hình 3.15) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 block">
              Chọn bác sĩ phụ trách và thời gian khám
            </span>

            {/* Bảng chọn bác sĩ */}
            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-100">
                    <th className="p-3 w-10">Chọn</th>
                    <th className="p-3">Bác sĩ phụ trách</th>
                    <th className="p-3">Chuyên khoa</th>
                    <th className="p-3">Phòng khám</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Ngày sinh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clinicDoctors.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`cursor-pointer transition ${
                        selectedDoctorId === doc.id ? 'bg-sky-50/70 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="radio"
                          name="doctorRadio"
                          checked={selectedDoctorId === doc.id}
                          onChange={() => setSelectedDoctorId(doc.id)}
                          className="text-sky-600"
                        />
                      </td>
                      <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                        <img src={doc.avatar} alt={doc.name} className="w-7 h-7 rounded-full object-cover" />
                        <span>{doc.name}</span>
                      </td>
                      <td className="p-3 text-teal-700">{doc.specialty}</td>
                      <td className="p-3 text-slate-600">{doc.room}</td>
                      <td className="p-3 text-slate-400">{doc.email}</td>
                      <td className="p-3 text-slate-500">{doc.dob}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chọn ngày khám (Lịch tuần ngang Hình 3.15) */}
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
                    <div className="text-[10px] opacity-80 mt-0.5">{d.date}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn giờ khám (Slot) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Giờ khám:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableTimeSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                      selectedSlot === slot
                        ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nút Chuyển sang thanh toán */}
          <div className="flex justify-end">
            <button
              onClick={handleNextToPayment}
              className="px-8 py-3.5 bg-gradient-to-r from-sky-600 to-teal-600 text-white font-bold rounded-2xl shadow-xl shadow-sky-600/30 hover:from-sky-700 hover:to-teal-700 transition flex items-center gap-2"
            >
              <span>Xác nhận & Thanh toán</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 2: THANH TOÁN DỊCH VỤ KHÁM VNPAY (HÌNH 3.16)         */}
      {/* ======================================================== */}
      {step === 2 && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại trang đặt lịch</span>
            </button>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Thanh toán dịch vụ khám</h2>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Lưu ý:</span>
              </span>
              <p>1. Kiểm tra kỹ thông tin dịch vụ, bác sĩ phụ trách và giờ khám mong muốn trước khi thanh toán.</p>
              <p>2. Chọn phương thức thanh toán VNPay để hoàn tất học phí dịch vụ khám.</p>
            </div>

            {/* Chi tiết đơn */}
            <div className="space-y-4 divide-y divide-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dịch vụ đã chọn</span>
                <div className="font-bold text-slate-800 text-base">{passedService.name}</div>
                <div className="text-emerald-600 font-extrabold text-sm">Phí khám: {passedService.price.toLocaleString()} đ</div>
              </div>

              <div className="pt-3 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bác sĩ phụ trách</span>
                <div className="font-bold text-slate-800">{selectedDoctor.name}</div>
                <div className="text-slate-500">{selectedDoctor.specialty} • {selectedDoctor.room}</div>
              </div>

              <div className="pt-3 space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Thời gian khám</span>
                <div className="font-bold text-slate-800">{selectedDate} (Khung giờ: {selectedSlot})</div>
              </div>

              <div className="pt-4 flex items-center justify-between text-base">
                <span className="font-bold text-slate-700">Tổng phí cần thanh toán:</span>
                <span className="font-black text-2xl text-emerald-600">{passedService.price.toLocaleString()} đ</span>
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full py-4 bg-gradient-to-r from-red-600 via-rose-600 to-sky-700 text-white font-black rounded-2xl shadow-xl shadow-rose-600/30 hover:opacity-95 transition flex items-center justify-center gap-2 text-sm tracking-wider uppercase"
            >
              <CreditCard className="w-5 h-5" />
              <span>Thanh toán qua VNPay</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 3: CỔNG THANH TOÁN VNPAY SANDBOX (HÌNH 3.16 DƯỚI)    */}
      {/* ======================================================== */}
      {step === 3 && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
          {/* VNPay Header */}
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-rose-600 text-lg">VNPAY</span>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Sandbox Test</span>
            </div>
            <span className="text-xs text-slate-400">Đơn hàng: ORDER_1760267841398</span>
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center space-y-1">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Số tiền thanh toán</span>
              <div className="text-3xl font-black text-slate-900">{passedService.price.toLocaleString()} VND</div>
              <p className="text-xs text-slate-400">Nhà cung cấp: MediClinic Vietnam</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">Chọn phương thức thanh toán:</label>
              <div className="space-y-2">
                <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                  vnpayMethod === 'NCB' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="method"
                      checked={vnpayMethod === 'NCB'}
                      onChange={() => setVnpayMethod('NCB')}
                      className="text-sky-600"
                    />
                    <span className="text-xs font-bold text-slate-800">Thẻ nội địa & tài khoản ngân hàng (NCB)</span>
                  </div>
                  <span className="text-xs font-extrabold text-blue-700">NCB</span>
                </label>

                <label className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition ${
                  vnpayMethod === 'QR' ? 'border-sky-500 bg-sky-50/50' : 'border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="method"
                      checked={vnpayMethod === 'QR'}
                      onChange={() => setVnpayMethod('QR')}
                      className="text-sky-600"
                    />
                    <span className="text-xs font-bold text-slate-800">App Ngân hàng & Ví điện tử (VNPAYQR)</span>
                  </div>
                  <span className="text-xs font-extrabold text-rose-600">QR</span>
                </label>
              </div>
            </div>

            {/* Giả lập nhập OTP */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Mã xác thực OTP (Mặc định: 123456):</label>
              <input
                type="text"
                value={vnpayOtp}
                onChange={(e) => setVnpayOtp(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-center font-bold tracking-widest text-lg"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition"
              >
                Hủy giao dịch
              </button>
              <button
                onClick={handleVnpaySubmit}
                disabled={vnpayProcessing}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30"
              >
                {vnpayProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>TIẾP TỤC THANH TOÁN</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BƯỚC 4: THANH TOÁN THÀNH CÔNG (HÌNH 3.16 DƯỚI)           */}
      {/* ======================================================== */}
      {step === 4 && (
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 text-center shadow-xl border border-slate-200 space-y-5 animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Thanh toán thành công!</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cảm ơn bạn đã thanh toán. Chúng tôi sẽ xác nhận lịch khám trong thời gian sớm nhất. Thông tin chi tiết đã được gửi đến email và số điện thoại của bạn.
          </p>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-left space-y-1">
            <div>Bác sĩ: <strong>{selectedDoctor.name}</strong></div>
            <div>Thời gian: <strong>{selectedDate} | {selectedSlot}</strong></div>
            <div>Số tiền: <strong className="text-emerald-600">{passedService.price.toLocaleString()} đ</strong></div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/patient/history')}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-sky-600/30"
            >
              Quay về Lịch sử khám bệnh
            </button>
          </div>
        </div>
      )}

      <AIChatWidget />
    </div>
  );
};

export default Booking;

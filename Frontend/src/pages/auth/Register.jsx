import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldPlus, Phone, Lock, User, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import AIChatWidget from '../../components/common/AIChatWidget';

const Register = () => {
  const [step, setStep] = useState(1); // 1: Nhập SĐT, 2: Nhập OTP, 3: Điền thông tin cá nhân
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['8', '6', '2', '1']);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    dob: '1995-05-20',
    gender: 'MALE',
    citizenId: '',
    insuranceCode: '',
    job: 'Nhân viên văn phòng',
    emergencyContact: '',
    address: 'Hà Nội'
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Vui lòng nhập số điện thoại đăng ký.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    setError('');
    setStep(3);
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await register({
        full_name: formData.fullName,
        email: formData.email || `${phoneNumber}@mediclinic.com`,
        password: formData.password,
        phone: phoneNumber,
        gender: formData.gender,
        date_of_birth: formData.dob,
        address: formData.address
      });
      navigate('/patient/booking', { replace: true });
    } catch (err) {
      setError(err.message || 'Đăng ký không thành công.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div 
      className="min-h-screen relative flex items-center justify-center p-4 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.55)), url('https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1600&auto=format&fit=crop&q=80')`
      }}
    >
      <div className="max-w-lg w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8 space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md shadow-sky-600/30">
            <ShieldPlus className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {step === 1 && 'Số điện thoại đăng ký'}
            {step === 2 && 'Xác thực số điện thoại'}
            {step === 3 && 'Đăng ký tài khoản'}
          </h2>
          <p className="text-xs text-slate-500">
            {step === 1 && 'Số điện thoại này sẽ được dùng để xác thực và là tài khoản đăng nhập của bạn sau này.'}
            {step === 2 && `Nhập mã OTP đã được gửi đến số điện thoại ${phoneNumber}`}
            {step === 3 && 'Nhập thông tin bên dưới để hoàn tất đăng ký'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* BƯỚC 1: Nhập Số điện thoại (Hình 3.12 giữa) */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">* Số điện thoại</label>
              <div className="flex gap-2">
                <span className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 flex items-center">
                  +84
                </span>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Nhập số điện thoại (VD: 0912325678)"
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition text-xs tracking-wider uppercase"
            >
              Nhận mã OTP
            </button>
          </form>
        )}

        {/* BƯỚC 2: Nhập OTP (Hình 3.12 dưới) */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
            <div className="flex justify-center gap-3">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => {
                    const newOtp = [...otp];
                    newOtp[idx] = e.target.value;
                    setOtp(newOtp);
                  }}
                  className="w-12 h-14 text-center font-black text-xl bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              ))}
            </div>

            <p className="text-xs text-slate-400">Mã OTP hết hạn sau: <strong className="text-sky-600">1:26</strong></p>

            <button
              type="submit"
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition text-xs tracking-wider uppercase"
            >
              XÁC THỰC
            </button>

            <div>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-sky-600 hover:underline">
                Gửi lại mã OTP
              </button>
            </div>
          </form>
        )}

        {/* BƯỚC 3: Điền Thông tin chi tiết (Hình 3.12 trên bên phải) */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Tài khoản</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* Số điện thoại</label>
                  <input
                    type="text"
                    disabled
                    value={phoneNumber}
                    className="w-full p-2 bg-slate-200 border border-slate-300 rounded-lg text-xs font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* Mật khẩu</label>
                  <input
                    type="password"
                    required
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    placeholder="Mật khẩu..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Thông tin cá nhân</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-slate-500">* Họ và tên</label>
                  <input
                    type="text"
                    required
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleFormChange}
                    placeholder="Nguyễn Văn Nghĩa"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* Ngày sinh</label>
                  <input
                    type="date"
                    name="dob"
                    value={formData.dob}
                    onChange={handleFormChange}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* Giới tính</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleFormChange}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="MALE">Nam</option>
                    <option value="FEMALE">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* CCCD/CMND</label>
                  <input
                    type="text"
                    name="citizenId"
                    value={formData.citizenId}
                    onChange={handleFormChange}
                    placeholder="126456789"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">Mã bảo hiểm y tế</label>
                  <input
                    type="text"
                    name="insuranceCode"
                    value={formData.insuranceCode}
                    onChange={handleFormChange}
                    placeholder="INS987654"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Thông tin liên hệ</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* SĐT liên hệ khẩn cấp</label>
                  <input
                    type="tel"
                    name="emergencyContact"
                    value={formData.emergencyContact}
                    onChange={handleFormChange}
                    placeholder="0987654521"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">* Địa chỉ</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleFormChange}
                    placeholder="Quận 1, TP.HCM"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition text-xs tracking-wider uppercase flex items-center justify-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>ĐĂNG KÝ HOÀN TẤT</span>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">
          Bạn đã có tài khoản?{' '}
          <Link to="/login" className="text-sky-600 font-bold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>

      <AIChatWidget />
    </div>
  );
};

export default Register;

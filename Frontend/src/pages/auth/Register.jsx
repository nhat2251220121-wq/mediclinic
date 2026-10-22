import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldPlus, Mail, Lock, User, AlertCircle, CheckCircle2, ArrowRight, RefreshCw } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const Register = () => {
  const [step, setStep] = useState(1); // 1: Nhập Email, 2: Nhập OTP, 3: Điền thông tin cá nhân
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    dob: '',
    gender: 'OTHER',
    citizenId: '',
    insuranceCode: '',
    job: '',
    emergencyContact: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    setSending(true);
    setError('');
    try {
      await axiosClient.post('/auth/send-otp-email', { email: email.trim() });
      setStep(2);
      setCountdown(300); // 5 phút
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Không thể gửi email. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleOtpChange = (value, idx) => {
    // Chỉ cho số
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[idx] = value;
    setOtp(newOtp);
    // Tự động nhảy sang ô kế tiếp
    if (value && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Vui lòng nhập đủ 6 chữ số của mã OTP.');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      await axiosClient.post('/auth/verify-otp-email', { email: email.trim(), otp: otpCode });
      setStep(3);
    } catch (err) {
      setError(err.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setSending(true);
    setError('');
    try {
      await axiosClient.post('/auth/send-otp-email', { email: email.trim() });
      setCountdown(300);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message || 'Không thể gửi lại email.');
    } finally {
      setSending(false);
    }
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
        email: email.trim(),
        password: formData.password,
        phone: formData.phone || null,
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

  const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-md shadow-sky-600/30">
            <ShieldPlus className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            {step === 1 && 'Xác nhận Email'}
            {step === 2 && 'Nhập mã xác thực'}
            {step === 3 && 'Đăng ký tài khoản'}
          </h2>
          <p className="text-xs text-slate-500">
            {step === 1 && 'Nhập email của bạn để nhận mã xác thực OTP. Email này sẽ là tài khoản đăng nhập của bạn.'}
            {step === 2 && (
              <span>Mã OTP 6 chữ số đã được gửi tới <strong className="text-sky-700">{email}</strong></span>
            )}
            {step === 3 && 'Nhập thông tin bên dưới để hoàn tất đăng ký'}
          </p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                step > s ? 'bg-emerald-500 text-white' :
                step === s ? 'bg-sky-600 text-white' :
                'bg-slate-200 text-slate-400'
              }`}>
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`h-0.5 w-10 rounded ${step > s ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* BƯỚC 1: Nhập Email */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">* Địa chỉ Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition text-xs tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Gửi mã OTP về Email</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* BƯỚC 2: Nhập OTP 6 chữ số */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-3 text-center">
                Nhập mã OTP gồm 6 chữ số
              </label>
              <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                    className="w-11 h-14 text-center font-black text-2xl bg-slate-50 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none transition"
                  />
                ))}
              </div>
            </div>

            {countdown > 0 ? (
              <p className="text-xs text-slate-400 text-center">
                Mã OTP hết hạn sau: <strong className="text-sky-600">{formatCountdown(countdown)}</strong>
              </p>
            ) : (
              <p className="text-xs text-rose-500 text-center font-semibold">Mã OTP đã hết hạn</p>
            )}

            <button
              type="submit"
              disabled={verifying || otp.join('').length < 6}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow-lg shadow-sky-600/30 transition text-xs tracking-wider uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verifying ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>XÁC THỰC</span>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); setOtp(['','','','','','']); setCountdown(0); }}
                className="text-slate-500 hover:text-sky-600"
              >
                ← Đổi email
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={countdown > 0 || sending}
                className={`flex items-center gap-1 font-semibold transition ${countdown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-sky-600 hover:underline'}`}
              >
                <RefreshCw className="w-3 h-3" />
                {sending ? 'Đang gửi...' : countdown > 0 ? `Gửi lại sau ${formatCountdown(countdown)}` : 'Gửi lại OTP'}
              </button>
            </div>
          </form>
        )}

        {/* BƯỚC 3: Điền Thông tin chi tiết */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="text-emerald-700 font-semibold">Email <strong>{email}</strong> đã xác thực thành công!</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Tài khoản</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">Email (đã xác thực)</label>
                  <input
                    type="text"
                    disabled
                    value={email}
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
                  <label className="text-[11px] font-semibold text-slate-500">Số điện thoại</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleFormChange}
                    placeholder="0912325678"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-500">CCCD/CMND</label>
                  <input
                    type="text"
                    name="citizenId"
                    value={formData.citizenId}
                    onChange={handleFormChange}
                    placeholder="126456789"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Thông tin liên hệ</span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500">SĐT liên hệ khẩn cấp</label>
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
                <>
                  <span>ĐĂNG KÝ HOÀN TẤT</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 pt-1 border-t border-slate-100">
          Bạn đã có tài khoản?{' '}
          <Link to="/login" className="text-sky-600 font-bold hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

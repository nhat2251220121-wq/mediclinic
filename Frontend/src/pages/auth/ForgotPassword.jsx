import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldPlus } from 'lucide-react';
import axiosClient from '../../api/axiosClient';

const formatCountdown = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const sendOtp = async (isResend = false) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Vui lòng nhập email hợp lệ.');
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await axiosClient.post('/auth/password-reset/send-otp', { email: normalizedEmail });
      setEmail(normalizedEmail);
      setOtp('');
      setCountdown(60);
      setStep(2);
      setNotice(response.message || 'Nếu email thuộc tài khoản MediClinic, mã xác thực sẽ được gửi.');
    } catch (requestError) {
      setError(requestError.message || (isResend ? 'Chưa thể gửi lại mã. Vui lòng thử sau.' : 'Không thể gửi OTP lúc này. Vui lòng thử lại sau.'));
    } finally { setBusy(false); }
  };

  const verifyOtp = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    if (!/^\d{6}$/.test(otp)) { setError('Mã OTP phải gồm đúng 6 chữ số.'); return; }
    setBusy(true);
    try {
      const response = await axiosClient.post('/auth/password-reset/verify-otp', { email, otp });
      setResetToken(response.data?.resetToken || '');
      setStep(3);
    } catch (requestError) {
      setError(requestError.message || 'OTP sai hoặc đã hết hạn. Hãy kiểm tra mã hoặc yêu cầu mã mới.');
    } finally { setBusy(false); }
  };

  const resetPassword = async (event) => {
    event.preventDefault(); setError(''); setNotice('');
    if (newPassword.length < 8 || !newPassword.trim()) { setError('Mật khẩu phải có ít nhất 8 ký tự và không được chỉ chứa khoảng trắng.'); return; }
    if (newPassword !== confirmPassword) { setError('Mật khẩu nhập lại không khớp.'); return; }
    setBusy(true);
    try {
      const response = await axiosClient.post('/auth/password-reset/reset', { resetToken, newPassword, confirmPassword });
      setNotice(response.message || 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.');
      setNewPassword(''); setConfirmPassword(''); setResetToken('');
      window.setTimeout(() => navigate('/login', { replace: true, state: { passwordResetSuccess: true } }), 1200);
    } catch (requestError) {
      setError(requestError.message || 'Không thể đổi mật khẩu. Hãy xác minh OTP lại nếu phiên đã hết hạn.');
    } finally { setBusy(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
    <section className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <header className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white"><ShieldPlus className="h-7 w-7" /></div>
        <h1 className="text-2xl font-black text-slate-800">Quên mật khẩu</h1>
        <p className="text-sm text-slate-500">{step === 1 ? 'Nhập email tài khoản để nhận mã xác minh.' : step === 2 ? 'Nhập OTP 6 chữ số đã gửi tới email.' : 'Tạo mật khẩu mới cho tài khoản của bạn.'}</p>
      </header>

      <div aria-label="Tiến trình đặt lại mật khẩu" className="mx-auto w-full max-w-sm py-1">
        <div className="relative">
          <div className="absolute left-[16.666%] right-[16.666%] top-4 h-0.5 rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-teal-700 transition-[width] duration-300" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }} />
          </div>
          <div className="relative grid grid-cols-3">
            {['Email', 'Xác minh OTP', 'Mật khẩu mới'].map((label, index) => {
              const number = index + 1;
              const completed = step > number;
              const active = step === number;
              return <div key={label} aria-current={active ? 'step' : undefined} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
                <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${active ? 'border-teal-700 bg-teal-700 text-white shadow-sm' : completed ? 'border-teal-700 bg-white text-teal-800' : 'border-slate-300 bg-white text-slate-400'}`}>
                  {completed ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : number}
                </span>
                <span className={`max-w-full px-0.5 text-[11px] leading-4 ${active ? 'font-bold text-teal-800' : completed ? 'font-semibold text-teal-700' : 'font-medium text-slate-500'}`}>{label}</span>
              </div>;
            })}
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{notice}</div>}

      {step === 1 && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); sendOtp(); }}>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="reset-email">Email</label>
        <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="reset-email" type="email" autoComplete="email" required maxLength={150} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@example.com" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none" /></div>
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Gửi OTP</button>
      </form>}

      {step === 2 && <div className="space-y-4">
        <p className="text-center text-sm text-slate-600">Email: <strong className="break-all">{email}</strong></p>
        <form className="space-y-4" onSubmit={verifyOtp}>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="reset-otp">Mã OTP</label>
          <input id="reset-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-sky-500 focus:bg-white focus:outline-none" />
          <button disabled={busy || otp.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Xác minh OTP</button>
        </form>
        <div className="flex items-center justify-between text-sm"><button type="button" onClick={() => { setStep(1); setError(''); setNotice(''); }} className="text-slate-600 hover:text-slate-900">Đổi email</button><button type="button" disabled={busy || countdown > 0} onClick={() => sendOtp(true)} className="font-semibold text-sky-700 disabled:text-slate-400">{countdown > 0 ? `Gửi lại sau ${formatCountdown(countdown)}` : 'Gửi lại OTP'}</button></div>
      </div>}

      {step === 3 && <form className="space-y-4" onSubmit={resetPassword}>
        <div><label htmlFor="reset-new-password" className="mb-1 block text-sm font-semibold text-slate-700">Mật khẩu mới</label><input id="reset-new-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none" /></div>
        <div><label htmlFor="reset-confirm-password" className="mb-1 block text-sm font-semibold text-slate-700">Nhập lại mật khẩu</label><input id="reset-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none" /></div>
        <button disabled={busy || !resetToken} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Đổi mật khẩu</button>
      </form>}

      <Link to="/login" className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600 hover:text-sky-700"><ArrowLeft className="h-4 w-4" />Quay lại đăng nhập</Link>
    </section>
  </main>;
};

export default ForgotPassword;

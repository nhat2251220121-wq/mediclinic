import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import ImageWithFallback from '../components/common/ImageWithFallback';
import { ShieldPlus, Calendar, Bot, History, ChevronDown, LogOut, User, X, Menu } from 'lucide-react';
import AIChatWidget from '../components/common/AIChatWidget';
import PatientNotificationBell from '../components/common/PatientNotificationBell';
import ClinicContact from '../components/common/ClinicContact';

const HomePage = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clinicServices, setClinicServices] = useState([]);
  const [serviceDoctors, setServiceDoctors] = useState([]);
  const [serviceDoctorsLoading, setServiceDoctorsLoading] = useState(false);
  const [serviceDoctorsError, setServiceDoctorsError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    axiosClient.get('/doctors/services')
      .then((serviceResult) => setClinicServices(serviceResult.data || []))
      .catch(() => setCatalogError('Không tải được danh mục hiện tại. Vui lòng thử tải lại trang.'))
      .finally(() => setCatalogLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedService) {
      setServiceDoctors([]);
      setServiceDoctorsLoading(false);
      setServiceDoctorsError('');
      return undefined;
    }
    if (!selectedService.specialty_id) {
      setServiceDoctors([]);
      setServiceDoctorsError('Dịch vụ chưa được Admin gán chuyên khoa.');
      return undefined;
    }
    let active = true;
    setServiceDoctors([]);
    setServiceDoctorsError('');
    setServiceDoctorsLoading(true);
    axiosClient.get(`/doctors?specialty_id=${encodeURIComponent(selectedService.specialty_id)}`)
      .then((result) => { if (active) setServiceDoctors(result.data || []); })
      .catch(() => { if (active) setServiceDoctorsError('Không tải được danh sách bác sĩ của chuyên khoa này.'); })
      .finally(() => { if (active) setServiceDoctorsLoading(false); });
    return () => { active = false; };
  }, [selectedService?.id, selectedService?.specialty_id]);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/login');
  };

  const handleBookingClick = (service) => {
    const bookingUrl = `/patient/booking?service_id=${encodeURIComponent(service.id)}`;
    if (!isAuthenticated || user?.role !== 'PATIENT') {
      navigate('/login', { state: { from: { pathname: '/patient/booking', search: `?service_id=${encodeURIComponent(service.id)}` }, selectedService: service } });
      return;
    }
    navigate(bookingUrl, { state: { selectedService: service } });
  };

  const getRoleLabel = (role) => {
    if (role === 'ADMIN') return 'Quản trị viên';
    if (role === 'DOCTOR') return 'Bác sĩ';
    return 'Bệnh nhân';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar theo mẫu đồ án */}
      <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="relative max-w-7xl h-full mx-auto flex items-center justify-between gap-2 px-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-700 rounded-xl flex items-center justify-center text-white shadow-sm">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg text-sky-800 tracking-tight leading-none">MediClinic</h1>
              <span className="hidden text-[10px] text-slate-500 font-medium uppercase tracking-wider sm:block">Hệ thống Y tế thông minh</span>
            </div>
          </Link>

          <nav aria-label="Điều hướng công khai" className="hidden min-w-0 flex-1 items-center justify-center gap-3 overflow-x-auto px-2 text-[11px] font-semibold text-slate-600 lg:flex lg:gap-5 lg:text-sm">
            <Link to="/#services" className="whitespace-nowrap transition-colors hover:text-sky-700">Dịch vụ y tế</Link>
            <Link to="/about" className="whitespace-nowrap transition-colors hover:text-sky-700">Giới thiệu phòng khám</Link>
            <Link to="/about#specialties" className="whitespace-nowrap transition-colors hover:text-sky-700">Chuyên khoa</Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button type="button" aria-label={mobileNavOpen ? 'Đóng điều hướng' : 'Mở điều hướng'} aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            {isAuthenticated ? (
              /* ===== DROPDOWN USER MENU ===== */
              <>
              {user?.role === 'PATIENT' && <PatientNotificationBell />}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 transition"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm border border-sky-200">
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-bold text-slate-800 leading-tight">{user?.full_name}</div>
                    <div className="text-[10px] text-emerald-600 font-semibold">{getRoleLabel(user?.role)}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu */}
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                      {user?.role === 'PATIENT' && <Link
                        to="/patient/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                      >
                        <User className="w-4 h-4 text-sky-600" />
                        <span>Hồ sơ cá nhân</span>
                      </Link>}
                      <Link
                        to="/patient/history"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                      >
                        <History className="w-4 h-4 text-sky-600" />
                        <span>Lịch sử khám bệnh</span>
                      </Link>
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition font-medium"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-xs font-bold text-slate-600 hover:text-sky-600 px-3 py-2 transition"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-sm shadow-sky-600/20"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>
          {mobileNavOpen && <nav aria-label="Điều hướng di động" className="absolute left-3 right-3 top-full z-50 mt-1 grid gap-1 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-lg lg:hidden">
            <Link onClick={() => setMobileNavOpen(false)} to="/#services" className="rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50">Dịch vụ y tế</Link>
            <Link onClick={() => setMobileNavOpen(false)} to="/about" className="rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50">Giới thiệu phòng khám</Link>
            <Link onClick={() => setMobileNavOpen(false)} to="/about#specialties" className="rounded-lg px-3 py-2.5 text-slate-700 hover:bg-slate-50">Chuyên khoa</Link>
          </nav>}
        </div>
      </header>

      <section id="about" className="bg-sky-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-100 text-sm font-medium">
            <span>Chăm sóc sức khỏe và đặt lịch khám</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Chăm sóc sức khỏe tại <span className="text-white">MediClinic</span>
          </h2>

          <p className="text-base text-slate-100 max-w-2xl mx-auto leading-relaxed">
            Xem dịch vụ, bác sĩ đang hoạt động và đặt lịch khám trực tuyến.
          </p>
        </div>
      </section>

      {/* Danh mục Dịch vụ của chúng tôi (Hình 3.13) */}
      <section id="services" className="max-w-7xl mx-auto px-6 py-16 flex-1 w-full space-y-10">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-sky-600 uppercase tracking-widest">Danh mục khám chữa bệnh</span>
          <h3 className="text-3xl font-black text-slate-800">Dịch vụ của chúng tôi</h3>
          <div className="w-16 h-1 bg-sky-500 mx-auto rounded-full mt-2"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {catalogLoading && <p className="col-span-full text-center text-sm text-slate-500">Đang tải dịch vụ…</p>}
          {catalogError && <p role="alert" className="col-span-full text-center text-sm text-rose-700">{catalogError}</p>}
          {!catalogLoading && !catalogError && clinicServices.length === 0 && <p className="col-span-full text-center text-sm text-slate-500">Hiện chưa có dịch vụ đang nhận đặt lịch.</p>}
          {clinicServices.map((svc) => (
            <div
              key={svc.id}
              className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col group"
            >
              <div className="h-24 bg-sky-50 flex items-center justify-center relative border-b border-slate-100">
                <ImageWithFallback src={svc.image_url} alt={svc.name} className="absolute inset-0 h-full w-full object-cover" fallback={<ShieldPlus className="w-9 h-9 text-sky-700" />} />
                <span className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full text-xs font-bold text-emerald-700 border border-slate-200">
                  {Number(svc.price).toLocaleString('vi-VN')} ₫
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-bold text-slate-800 text-base group-hover:text-sky-600 transition">
                    {svc.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                    {svc.description}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedService(svc)}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200"
                  >
                    Xem chi tiết dịch vụ
                  </button>
                  <button
                    onClick={() => handleBookingClick(svc)}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Đặt lịch khám</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal Thông tin chi tiết dịch vụ (Khớp 100% Hình 3.14) */}
      {selectedService && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedService(null)}></div>
          <div className="relative bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-800">Thông tin dịch vụ</h3>
              <button onClick={() => setSelectedService(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <ImageWithFallback src={selectedService.image_url} alt={selectedService.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200" fallback={<ShieldPlus className="w-8 h-8 text-sky-700" />} />
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedService.name}</h4>
                  <div className="text-sm font-extrabold text-emerald-600 mt-1">
                    Phí khám: {Number(selectedService.price).toLocaleString('vi-VN')} ₫
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedService.description}
                  </p>
                </div>
              </div>

              {/* Public doctor directory */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Bác sĩ đang hoạt động:
                </span>
                {!selectedService.specialty_id
                  ? <p role="status" className="text-xs text-amber-700">Dịch vụ này chưa được Admin gán chuyên khoa nên chưa thể liệt kê bác sĩ.</p>
                  : serviceDoctorsLoading
                    ? <p className="text-xs text-slate-500">Đang tải bác sĩ thuộc chuyên khoa {selectedService.specialty_name || ''}…</p>
                    : serviceDoctorsError
                      ? <p role="alert" className="text-xs text-rose-700">{serviceDoctorsError}</p>
                      : serviceDoctors.length === 0
                        ? <p className="text-xs text-slate-500">Chưa có bác sĩ đang hoạt động thuộc chuyên khoa {selectedService.specialty_name || 'của dịch vụ này'}.</p>
                        : serviceDoctors.map((doc) => (
                  <div key={doc.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4 items-start">
                    <ImageWithFallback src={doc.avatar_url} alt={doc.full_name} className="h-16 w-16 shrink-0 rounded-full object-cover" fallback={<span className="font-bold text-xl">{doc.full_name?.charAt(0) || 'B'}</span>} />
                    <div className="text-xs space-y-1">
                      <div className="font-semibold text-slate-900 text-sm">{doc.full_name}</div>
                      <div className="text-teal-700">{doc.specialty_name || 'Chưa phân chuyên khoa'} • {doc.room_name || doc.room_number || 'Phòng khám'}</div>
                      <div className="text-slate-500">Kinh nghiệm: {doc.experience_years || 0} năm</div>
                      {doc.bio && <p className="text-slate-600 leading-relaxed pt-1">{doc.bio}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  const s = selectedService;
                  setSelectedService(null);
                  handleBookingClick(s);
                }}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sky-600/20"
              >
                Đặt lịch khám dịch vụ này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chatbot AI Widget luôn hiển thị ở góc phải (Hình 3.40) */}
      <AIChatWidget />

      {/* Footer */}
      <footer className="min-w-0 border-t border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 sm:px-6">
        <div className="mx-auto max-w-7xl min-w-0"><ClinicContact /></div>
      </footer>
    </div>
  );
};

export default HomePage;

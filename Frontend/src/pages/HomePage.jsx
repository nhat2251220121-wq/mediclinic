import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldPlus, Calendar, Bot, ArrowRight, User, Stethoscope, Phone, Mail, Award, CheckCircle2, ChevronRight, X } from 'lucide-react';
import AIChatWidget from '../components/common/AIChatWidget';

const clinicServices = [
  {
    id: 1,
    name: 'Khám Nội tổng quát',
    price: 300000,
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&auto=format&fit=crop&q=60',
    description: 'Kiểm tra sức khỏe định kỳ, tư vấn điều trị toàn diện các bệnh lý tiêu hóa, hô hấp, tuần hoàn và trao đổi chất.',
    doctors: [
      {
        name: 'BS. CKII Nguyễn Văn An',
        specialty: 'Nội tổng quát',
        room: 'Phòng Khám Nội Tổng Quát - Tầng 1 (P.101)',
        experience: 'Tốt nghiệp Bác sĩ Chuyên khoa II Đại học Y Dược. Có hơn 15 năm kinh nghiệm trong điều trị các bệnh nội khoa tổng quát và tim mạch.',
        email: 'doctor.an@mediclinic.com',
        avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 2,
    name: 'Khám Ngoại',
    price: 500000,
    image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=500&auto=format&fit=crop&q=60',
    description: 'Dịch vụ Khám Ngoại tập trung vào chẩn đoán và điều trị các bệnh lý liên quan hệ cơ xương khớp, chấn thương, vết thương phần mềm.',
    doctors: [
      {
        name: 'BS. CKI Trần Thị Bình',
        specialty: 'Ngoại khoa & Tim mạch',
        room: 'Phòng Khám Ngoại - Tầng 1 (P.102)',
        experience: 'Tốt nghiệp Bác sĩ Chuyên khoa Ngoại tại Đại học Y Dược TP.HCM. Hơn 12 năm kinh nghiệm điều trị bệnh lý mạch vành và chấn thương mô mềm.',
        email: 'doctor.binh@mediclinic.com',
        avatar: 'https://images.unsplash.com/photo-1594824813583-82f5b61e2715?w=150&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 3,
    name: 'Khám Da liễu',
    price: 250000,
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=500&auto=format&fit=crop&q=60',
    description: 'Chăm sóc và điều trị các bệnh lý về da như viêm da dị ứng, mụn trứng cá, chàm, nấm da và thẩm mỹ y khoa.',
    doctors: [
      {
        name: 'ThS. BS Lê Đức Thái',
        specialty: 'Da liễu lâm sàng',
        room: 'Phòng Da Liễu - Tầng 2 (P.201)',
        experience: 'Thạc sĩ Da liễu, từng tu nghiệp tại Pháp, chuyên sâu về trị liệu laser và phục hồi cấu trúc da liễu thẩm mỹ y khoa.',
        email: 'doctor.thai@mediclinic.com',
        avatar: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&auto=format&fit=crop&q=80'
      }
    ]
  },
  {
    id: 4,
    name: 'Khám Răng - Hàm - Mặt',
    price: 400000,
    image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=500&auto=format&fit=crop&q=60',
    description: 'Khám, tư vấn và điều trị các vấn đề về răng miệng như sâu răng, viêm nướu, chỉnh nha, nhổ răng, tẩy trắng và thẩm mỹ nụ cười.',
    doctors: [
      {
        name: 'BS. Đào Phan Quốc Hoài',
        specialty: 'Răng Hàm Mặt',
        room: 'Phòng Răng Hàm Mặt - Tầng 2 (P.202)',
        experience: 'Bác sĩ chuyên khoa Răng Hàm Mặt giàu kinh nghiệm, tận tâm mang lại sự an tâm và nụ cười khỏe đẹp cho người bệnh.',
        email: 'doctor.hoai@mediclinic.com',
        avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=150&auto=format&fit=crop&q=80'
      }
    ]
  }
];

const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);

  const handleBookingClick = (service) => {
    navigate('/patient/booking', { state: { selectedService: service } });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navbar theo mẫu đồ án */}
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl h-full mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-sky-600/30">
              <ShieldPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl text-sky-700 tracking-tight leading-none">MediClinic</h1>
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider">Hệ thống Y tế thông minh</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#services" className="hover:text-sky-600 transition">Dịch vụ y tế</a>
            <a href="#about" className="hover:text-sky-600 transition">Giới thiệu phòng khám</a>
            <Link to="/patient/ai-chat" className="text-teal-600 hover:text-teal-700 flex items-center gap-1 font-bold">
              <Bot className="w-4 h-4" />
              <span>Trợ lý AI Triệu chứng</span>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 hidden sm:inline">
                  Xin chào, <strong className="text-sky-700">{user?.full_name}</strong>
                </span>
                <Link
                  to={user?.role === 'ADMIN' ? '/admin/dashboard' : user?.role === 'DOCTOR' ? '/doctor/queue' : '/patient/ai-chat'}
                  className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition shadow-sm"
                >
                  Vào Cổng Hệ Thống
                </Link>
              </div>
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
        </div>
      </header>

      {/* Hero Banner (Hình 3.13) */}
      <section className="relative bg-gradient-to-r from-sky-900 via-sky-800 to-teal-800 text-white py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-sky-200 text-xs font-semibold border border-white/20">
            <span>✨ Phòng Khám Đa Khoa Hiện Đại Hàng Đầu</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Chào mừng đến với <span className="text-teal-300">Phòng khám Sức Khỏe!</span>
          </h2>

          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto font-normal leading-relaxed">
            Nơi chăm sóc sức khỏe toàn diện cho bạn và gia đình. Tích hợp Trợ lý Trí tuệ Nhân tạo (AI) hỗ trợ tư vấn và định hướng chuyên khoa 24/7.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/patient/booking"
              className="px-8 py-3.5 bg-gradient-to-r from-teal-500 to-sky-500 hover:from-teal-600 hover:to-sky-600 text-white font-bold rounded-2xl transition-all shadow-xl shadow-teal-500/30 flex items-center gap-2"
            >
              <Calendar className="w-5 h-5" />
              <span>Đặt lịch hẹn ngay</span>
            </Link>

            <Link
              to="/patient/ai-chat"
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl backdrop-blur-md border border-white/20 transition flex items-center gap-2"
            >
              <Bot className="w-5 h-5 text-teal-300" />
              <span>Hỏi Trợ lý AI Triệu chứng</span>
            </Link>
          </div>
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
          {clinicServices.map((svc) => (
            <div
              key={svc.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
            >
              <div className="h-44 overflow-hidden relative">
                <img
                  src={svc.image}
                  alt={svc.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black text-emerald-600 shadow-sm">
                  {svc.price.toLocaleString()} đ
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
          <div className="relative bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 z-10 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-800">Thông tin dịch vụ</h3>
              <button onClick={() => setSelectedService(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <img
                  src={selectedService.image}
                  alt={selectedService.name}
                  className="w-24 h-24 rounded-2xl object-cover border border-slate-200"
                />
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedService.name}</h4>
                  <div className="text-sm font-extrabold text-emerald-600 mt-1">
                    Phí khám: {selectedService.price.toLocaleString()} đ
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {selectedService.description}
                  </p>
                </div>
              </div>

              {/* Bác sĩ phụ trách dịch vụ */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Bác sĩ phụ trách dịch vụ:
                </span>
                {selectedService.doctors.map((doc, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex gap-4 items-start">
                    <img
                      src={doc.avatar}
                      alt={doc.name}
                      className="w-14 h-14 rounded-2xl object-cover border border-slate-300"
                    />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                      <div className="text-teal-700 font-semibold">{doc.specialty} • {doc.room}</div>
                      <p className="text-slate-600 italic leading-relaxed pt-1">{doc.experience}</p>
                      <div className="text-slate-400 pt-1 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{doc.email}</span>
                      </div>
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
      <footer className="bg-white border-t border-slate-200 py-8 px-6 text-center text-xs text-slate-500">
        <p>&copy; 2025 - 2026 MediClinic - Hệ thống Quản lý Phòng khám tích hợp AI Agent.</p>
        <p className="mt-1">Đồ án tốt nghiệp Đại học - Học viện Công nghệ Bưu chính Viễn thông (PTIT).</p>
      </footer>
    </div>
  );
};

export default HomePage;

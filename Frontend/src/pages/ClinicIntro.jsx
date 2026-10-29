import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowRight, CalendarCheck2, Check, ChevronRight, Compass, ShieldPlus, Stethoscope } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import ImageWithFallback from '../components/common/ImageWithFallback';
import ClinicContact from '../components/common/ClinicContact';
import PublicSiteHeader from '../components/layout/PublicSiteHeader';

const heroImage = '/assets/clinic-consultation.jpg';

const DataState = ({ children, error = false }) => (
  <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`} role={error ? 'alert' : 'status'}>{children}</div>
);

const ClinicIntro = () => {
  const location = useLocation();
  const [specialties, setSpecialties] = useState([]);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [specialtyLoading, setSpecialtyLoading] = useState(true);
  const [specialtyError, setSpecialtyError] = useState('');
  const [serviceLoading, setServiceLoading] = useState(true);
  const [serviceError, setServiceError] = useState('');
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorError, setDoctorError] = useState('');

  useEffect(() => {
    let active = true;
    axiosClient.get('/doctors/specialties')
      .then((result) => {
        if (!active) return;
        const rows = result.data || [];
        setSpecialties(rows);
        if (rows.length) setSelectedId((current) => current || String(rows[0].id));
      })
      .catch((error) => { if (active) setSpecialtyError(error.message || 'Không tải được danh sách chuyên khoa.'); })
      .finally(() => { if (active) setSpecialtyLoading(false); });
    axiosClient.get('/doctors/services')
      .then((result) => { if (active) setServices(result.data || []); })
      .catch((error) => { if (active) setServiceError(error.message || 'Không tải được danh sách dịch vụ.'); })
      .finally(() => { if (active) setServiceLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDoctors([]);
      setDoctorLoading(false);
      setDoctorError('');
      return undefined;
    }
    let active = true;
    setDoctors([]);
    setDoctorLoading(true);
    setDoctorError('');
    axiosClient.get(`/doctors?specialty_id=${encodeURIComponent(selectedId)}`)
      .then((result) => { if (active) setDoctors(result.data || []); })
      .catch((error) => { if (active) setDoctorError(error.message || 'Không tải được danh sách bác sĩ.'); })
      .finally(() => { if (active) setDoctorLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  useEffect(() => {
    if (location.hash === '#specialties') {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      window.requestAnimationFrame(() => document.getElementById('specialties')?.scrollIntoView({ behavior, block: 'start' }));
    }
  }, [location.hash]);

  const selected = useMemo(() => specialties.find((item) => String(item.id) === selectedId), [specialties, selectedId]);
  const relatedServices = useMemo(() => services.filter((service) => Number(service.specialty_id) === Number(selectedId)), [services, selectedId]);

  return <div className="min-h-screen bg-[#f7f8f6] text-slate-800">
    <PublicSiteHeader />
    <main>
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8 lg:pt-12">
        <div className="about-reveal grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-[1fr_0.92fr]">
          <div className="flex flex-col justify-center px-6 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-14">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800"><ShieldPlus className="h-3.5 w-3.5" />Thông tin rõ ràng, lịch hẹn thuận tiện</p>
            <h1 className="mt-5 max-w-xl text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">Tìm hiểu dịch vụ và đặt lịch khám cùng MediClinic</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              MediClinic giúp người dùng tra cứu các chuyên khoa, dịch vụ và thông tin bác sĩ đang hoạt động được công khai trên hệ thống. Bệnh nhân có thể chọn dịch vụ phù hợp, gửi yêu cầu đặt lịch và theo dõi lịch hẹn trong tài khoản của mình.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#specialties" className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800">Xem chuyên khoa <ArrowDown className="h-4 w-4" /></a>
              <a href="/#services" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-300 hover:bg-teal-50">Đặt lịch khám <ArrowRight className="h-4 w-4 text-teal-700" /></a>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Đặt lịch yêu cầu đăng nhập bằng tài khoản bệnh nhân.</p>
          </div>
          <figure className="relative min-h-[17rem] overflow-hidden bg-slate-200 sm:min-h-[21rem] md:min-h-full">
            <img src={heroImage} alt="Ảnh minh họa buổi trao đổi giữa bác sĩ và bệnh nhân" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
            <figcaption className="absolute bottom-0 left-0 right-0 p-5 text-xs text-white/90 sm:p-7">Ảnh minh họa · Không đại diện cho cơ sở hoặc nhân sự cụ thể của MediClinic</figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Cách sử dụng</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Các bước rõ ràng từ tra cứu đến theo dõi</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Các bước dưới đây tương ứng với những chức năng đang có trên hệ thống.</p>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {[
            { n: '01', icon: Compass, title: 'Tìm hiểu thông tin', text: 'Xem chuyên khoa, các dịch vụ đang hoạt động và bác sĩ được liên kết với chuyên khoa.' },
            { n: '02', icon: CalendarCheck2, title: 'Gửi yêu cầu đặt lịch', text: 'Đăng nhập bằng tài khoản bệnh nhân, chọn dịch vụ, bác sĩ và khung giờ còn trống.' },
            { n: '03', icon: Check, title: 'Theo dõi lịch hẹn', text: 'Mở tài khoản để xem trạng thái lịch, lịch sử khám và thông báo liên quan.' },
          ].map(({ n, icon: Icon, title, text }) => <article key={n} className="about-reveal flex gap-4 border-t-2 border-teal-700 bg-white px-5 py-5 shadow-sm sm:px-6">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800"><Icon className="h-5 w-5" /></span>
            <div><p className="text-xs font-semibold tracking-wide text-teal-700">BƯỚC {n}</p><h3 className="mt-1 font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
          </article>)}
        </div>
      </section>

      <section id="specialties" className="scroll-mt-20 bg-[#edf2ef] py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Danh mục đang hoạt động</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Tìm hiểu chuyên khoa</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">Chọn một chuyên khoa để xem các dịch vụ và bác sĩ đang hoạt động được liên kết trong dữ liệu hiện tại.</p>
            </div>
            <Link to="/#services" className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-900">Danh mục dịch vụ <ChevronRight className="h-4 w-4" /></Link>
          </div>

          {specialtyError ? <div className="mt-6"><DataState error>{specialtyError}</DataState></div>
            : specialtyLoading ? <div className="mt-6"><DataState>Đang tải danh sách chuyên khoa…</DataState></div>
              : specialties.length === 0 ? <div className="mt-6"><DataState>Hiện chưa có chuyên khoa đang hoạt động.</DataState></div>
                : <>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {specialties.map((specialty, index) => {
                      const specialtyServices = services.filter((service) => Number(service.specialty_id) === Number(specialty.id));
                      const imageService = specialtyServices.find((service) => service.image_url);
                      const isSelected = selectedId === String(specialty.id);
                      return <button key={specialty.id} type="button" onClick={() => setSelectedId(String(specialty.id))} aria-pressed={isSelected} className={`about-reveal group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition-colors ${isSelected ? 'border-teal-600 ring-1 ring-teal-600' : 'border-slate-200 hover:border-teal-300'}`}>
                        <div className="relative h-36 overflow-hidden bg-slate-200 sm:h-40">
                          <ImageWithFallback src={imageService?.image_url || heroImage} alt={imageService ? imageService.name : `Ảnh minh họa cho chuyên khoa ${specialty.name}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" style={{ objectPosition: imageService ? 'center' : `${35 + (index % 3) * 15}% center` }} fallback={<span className="flex h-full w-full items-center justify-center bg-teal-50 text-teal-800"><Stethoscope className="h-8 w-8" /></span>} />
                          {!imageService && <span className="absolute bottom-2 right-2 rounded bg-slate-950/60 px-2 py-1 text-[10px] font-medium text-white">Ảnh minh họa</span>}
                        </div>
                        <span className="block p-4 sm:p-5">
                          <span className="flex items-start justify-between gap-3"><span className="text-base font-semibold text-slate-900">{specialty.name}</span><ArrowRight className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${isSelected ? 'translate-x-0.5 text-teal-700' : 'text-slate-400 group-hover:translate-x-0.5'}`} /></span>
                          <span className="mt-2 block min-h-10 text-sm leading-6 text-slate-600">{specialty.description || `Khám phá dịch vụ và thông tin bác sĩ được hệ thống liên kết với chuyên khoa ${specialty.name}.`}</span>
                        </span>
                      </button>;
                    })}
                  </div>

                  {selected && <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-live="polite">
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Thông tin chuyên khoa</p><h3 className="mt-1 text-xl font-semibold text-slate-900">{selected.name}</h3><p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate-600">{selected.description || `Danh mục bên dưới hiển thị dịch vụ và bác sĩ đang hoạt động được hệ thống liên kết với chuyên khoa ${selected.name}.`}</p></div>
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800"><Stethoscope className="h-3.5 w-3.5" />Thông tin công khai</span>
                    </div>
                    <div className="grid gap-7 pt-5 lg:grid-cols-2">
                      <section>
                        <h4 className="font-semibold text-slate-900">Dịch vụ liên quan</h4>
                        {serviceError ? <div className="mt-3"><DataState error>{serviceError}</DataState></div> : serviceLoading ? <p className="mt-3 text-sm text-slate-500" role="status">Đang tải dịch vụ…</p> : relatedServices.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600" role="status">Chưa có dịch vụ đang hoạt động thuộc chuyên khoa này.</p> : <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                          {relatedServices.map((service) => <li key={service.id} className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
                            <ImageWithFallback src={service.image_url} alt={service.name} className="h-14 w-16 shrink-0 rounded-md object-cover" fallback={<span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-800"><Stethoscope className="h-5 w-5" /></span>} />
                            <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-slate-800">{service.name}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{service.description || 'Chưa có mô tả dịch vụ.'}</span><span className="mt-1.5 block text-sm font-semibold text-teal-800">{Number(service.price).toLocaleString('vi-VN')} ₫</span></span>
                          </li>)}
                        </ul>}
                      </section>
                      <section>
                        <h4 className="font-semibold text-slate-900">Bác sĩ đang hoạt động</h4>
                        {doctorError ? <div className="mt-3"><DataState error>{doctorError}</DataState></div> : doctorLoading ? <p className="mt-3 text-sm text-slate-500" role="status">Đang tải bác sĩ…</p> : doctors.length === 0 ? <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600" role="status">Chưa có bác sĩ đang hoạt động thuộc chuyên khoa này.</p> : <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                          {doctors.map((doctor) => <li key={doctor.id} className="flex min-w-0 items-start gap-3 p-3 sm:p-4">
                            <ImageWithFallback src={doctor.avatar_url} alt={doctor.full_name || 'Bác sĩ'} className="h-12 w-12 shrink-0 rounded-full object-cover" fallback={<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800"><Stethoscope className="h-5 w-5" /></span>} />
                            <span className="min-w-0"><span className="block break-words text-sm font-semibold text-slate-800">{doctor.full_name || 'Chưa cập nhật'}</span><span className="mt-1 block text-xs text-slate-500">{doctor.specialty_name || selected.name}{doctor.experience_years != null ? ` · ${doctor.experience_years} năm kinh nghiệm` : ''}</span>{doctor.bio && <span className="mt-2 block line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-600">{doctor.bio}</span>}</span>
                          </li>)}
                        </ul>}
                      </section>
                    </div>
                  </section>}
                </>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-5 rounded-xl border border-teal-200 bg-teal-50 px-5 py-6 sm:flex-row sm:items-center sm:px-8">
          <div><h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Bạn đã chọn được dịch vụ phù hợp?</h2><p className="mt-1 text-sm leading-6 text-slate-600">Xem danh mục dịch vụ hiện có và bắt đầu quy trình đặt lịch.</p></div>
          <a href="/#services" className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800">Xem dịch vụ <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>
    </main>
    <footer className="min-w-0 border-t border-slate-200 bg-white px-4 py-7 sm:px-6">
      <div className="mx-auto max-w-7xl min-w-0"><ClinicContact /></div>
    </footer>
  </div>;
};

export default ClinicIntro;

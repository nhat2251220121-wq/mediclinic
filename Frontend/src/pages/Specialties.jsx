import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Stethoscope } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import ImageWithFallback from '../components/common/ImageWithFallback';
import PublicSiteHeader from '../components/layout/PublicSiteHeader';

const SpecialtyState = ({ children, tone = 'neutral' }) => {
  const toneClass = tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600';
  return <div className={`rounded-xl border p-4 text-sm ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
};

const Specialties = () => {
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
        if (rows.length) setSelectedId(String(rows[0].id));
      })
      .catch((error) => { if (active) setSpecialtyError(error.message || 'Không tải được danh sách chuyên khoa.'); })
      .finally(() => { if (active) setSpecialtyLoading(false); });
    axiosClient.get('/doctors/services')
      .then((result) => { if (active) setServices(result.data || []); })
      .catch((error) => { if (active) setServiceError(error.message || 'Không tải được danh sách dịch vụ liên quan.'); })
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
      .catch((error) => { if (active) setDoctorError(error.message || 'Không tải được danh sách bác sĩ của chuyên khoa.'); })
      .finally(() => { if (active) setDoctorLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const selected = useMemo(() => specialties.find((item) => String(item.id) === selectedId), [specialties, selectedId]);
  const relatedServices = useMemo(() => services.filter((service) => Number(service.specialty_id) === Number(selectedId)), [services, selectedId]);

  return <div className="min-h-screen bg-slate-50 text-slate-800">
    <PublicSiteHeader />
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="mb-6 border-b border-slate-200 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Thông tin khám chữa bệnh</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Chuyên khoa</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Danh sách chuyên khoa đang hoạt động được tải từ MediClinic. Chọn một khoa để xem thông tin và dịch vụ, bác sĩ liên quan nếu có.</p>
      </header>

      {specialtyError ? <SpecialtyState tone="error">{specialtyError}</SpecialtyState>
        : specialtyLoading ? <SpecialtyState>Đang tải danh sách chuyên khoa…</SpecialtyState>
          : specialties.length === 0 ? <SpecialtyState>Hiện chưa có chuyên khoa đang hoạt động.</SpecialtyState>
            : <div className="grid gap-6 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2fr)]">
              <nav aria-label="Danh sách chuyên khoa" className="h-fit divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {specialties.map((specialty) => <button key={specialty.id} type="button" onClick={() => setSelectedId(String(specialty.id))} aria-current={selectedId === String(specialty.id) ? 'true' : undefined} className={`flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${selectedId === String(specialty.id) ? 'bg-sky-50 text-sky-800' : 'text-slate-700 hover:bg-slate-50'}`}>
                  <span><span className="block text-sm font-semibold">{specialty.name}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{specialty.description || 'Chưa có mô tả.'}</span></span>
                  <ArrowRight className={`mt-0.5 h-4 w-4 shrink-0 ${selectedId === String(specialty.id) ? 'text-sky-700' : 'text-slate-400'}`} />
                </button>)}
              </nav>

              {selected && <section aria-live="polite" className="min-w-0 space-y-7">
                <div className="border-b border-slate-200 pb-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Chuyên khoa</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{selected.name}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{selected.description || 'Chưa có mô tả cho chuyên khoa này.'}</p>
                </div>

                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="font-semibold text-slate-900">Dịch vụ liên quan</h3><Link to="/#services" className="text-xs font-semibold text-sky-700 hover:text-sky-800">Xem tất cả dịch vụ</Link></div>
                  {serviceError ? <SpecialtyState tone="error">{serviceError}</SpecialtyState> : serviceLoading ? <SpecialtyState>Đang tải dịch vụ…</SpecialtyState> : relatedServices.length === 0 ? <SpecialtyState>Chưa có dịch vụ đang hoạt động thuộc chuyên khoa này.</SpecialtyState> : <div className="grid gap-3 sm:grid-cols-2">{relatedServices.map((service) => <article key={service.id} className="flex min-w-0 gap-3 border border-slate-200 bg-white p-3.5">
                    <ImageWithFallback src={service.image_url} alt={service.name} className="h-16 w-20 shrink-0 rounded-lg object-cover" fallback={<span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Stethoscope className="h-5 w-5" /></span>} />
                    <div className="min-w-0"><h4 className="font-semibold text-slate-800">{service.name}</h4><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{service.description || 'Chưa có mô tả dịch vụ.'}</p><p className="mt-2 text-sm font-semibold text-sky-800">{Number(service.price).toLocaleString('vi-VN')} đ</p></div>
                  </article>)}</div>}
                </section>

                <section>
                  <h3 className="mb-3 font-semibold text-slate-900">Bác sĩ thuộc chuyên khoa</h3>
                  {doctorError ? <SpecialtyState tone="error">{doctorError}</SpecialtyState> : doctorLoading ? <SpecialtyState>Đang tải danh sách bác sĩ…</SpecialtyState> : doctors.length === 0 ? <SpecialtyState>Chưa có bác sĩ đang hoạt động thuộc chuyên khoa này.</SpecialtyState> : <div className="grid gap-3 sm:grid-cols-2">{doctors.map((doctor) => <article key={doctor.id} className="flex min-w-0 items-start gap-3 border border-slate-200 bg-white p-4">
                    <ImageWithFallback src={doctor.avatar_url} alt={doctor.full_name} className="h-14 w-14 shrink-0 rounded-full object-cover" fallback={<span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Stethoscope className="h-5 w-5" /></span>} />
                    <div className="min-w-0"><h4 className="break-words font-semibold text-slate-800">{doctor.full_name || 'Chưa cập nhật'}</h4><p className="mt-1 text-xs text-slate-500">{doctor.specialty_name || selected.name}{doctor.experience_years != null ? ` · ${doctor.experience_years} năm kinh nghiệm` : ''}</p><p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-slate-600">{doctor.bio || 'Chưa có phần giới thiệu.'}</p></div>
                  </article>)}</div>}
                </section>
              </section>}
            </div>}
    </main>
  </div>;
};

export default Specialties;

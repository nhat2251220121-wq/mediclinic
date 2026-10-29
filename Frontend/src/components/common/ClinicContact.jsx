import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, ShieldPlus } from 'lucide-react';

const contactItems = [
  { label: 'Địa chỉ', value: import.meta.env.VITE_CLINIC_ADDRESS, icon: MapPin },
  { label: 'Điện thoại', value: import.meta.env.VITE_CLINIC_PHONE, icon: Phone, href: (value) => `tel:${value.replace(/[^\d+]/g, '')}` },
  { label: 'Email', value: import.meta.env.VITE_CLINIC_EMAIL, icon: Mail, href: (value) => `mailto:${value}` }
].filter((item) => typeof item.value === 'string' && item.value.trim());

const ClinicContact = ({ className = '' }) => (
  <section aria-label="Thông tin cuối trang MediClinic" className={`min-w-0 ${className}`}>
    <div className="grid min-w-0 gap-8 py-2 sm:grid-cols-2 lg:grid-cols-[1fr_1.25fr_0.8fr] lg:gap-12">
      <div className="min-w-0">
        <Link to="/" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white"><ShieldPlus className="h-6 w-6" /></span>
          <span><span className="block text-lg font-semibold tracking-tight text-slate-900">MediClinic</span><span className="block text-[11px] font-medium text-slate-500">Hệ thống Y tế thông minh</span></span>
        </Link>
        <p className="mt-4 max-w-xs text-sm leading-6 text-slate-600">Đồng hành cùng bạn trong việc tìm hiểu dịch vụ và đặt lịch khám.</p>
      </div>

      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Thông tin liên hệ</h2>
        {contactItems.length ? <ul className="mt-4 grid min-w-0 gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1">
          {contactItems.map(({ label, value, icon: Icon, href }) => <li key={label} className="flex min-w-0 items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" aria-hidden="true" />
            <span className="min-w-0"><span className="block text-xs font-medium text-slate-500">{label}</span>{href ? <a className="mt-0.5 block break-words font-medium text-slate-700 underline decoration-transparent underline-offset-2 hover:text-teal-800 hover:decoration-current" href={href(value)}>{value}</a> : <span className="mt-0.5 block break-words font-medium text-slate-700">{value}</span>}</span>
          </li>)}
        </ul> : <p className="mt-3 text-sm leading-6 text-slate-500">Thông tin liên hệ của phòng khám chưa được cấu hình.</p>}
      </div>

      <nav aria-label="Liên kết cuối trang" className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">Khám phá MediClinic</h2>
        <ul className="mt-4 grid gap-3 text-sm font-medium text-slate-600">
          <li><Link to="/#services" className="hover:text-teal-800">Dịch vụ y tế</Link></li>
          <li><Link to="/about" className="hover:text-teal-800">Giới thiệu phòng khám</Link></li>
          <li><Link to="/about#specialties" className="hover:text-teal-800">Chuyên khoa</Link></li>
        </ul>
      </nav>
    </div>
    <div className="mt-7 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">&copy; {new Date().getFullYear()} MediClinic. Thông tin lịch hẹn được xác nhận bởi phòng khám.</div>
  </section>
);

export default ClinicContact;

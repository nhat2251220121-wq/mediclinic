import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Stethoscope,
  Pill,
  Building,
  Layers,
  Clock,
  History,
  Bot,
  ShieldPlus,
  Receipt
} from 'lucide-react';

const Sidebar = () => {
  const { role } = useAuth();

  // Menu Admin khớp 100% tài liệu đồ án (Hình 3.1 -> 3.7)
  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { to: '/admin/medicines', icon: Pill, label: 'Quản lý thuốc' },
    { to: '/admin/specialties', icon: Layers, label: 'Quản lý chuyên khoa' },
    { to: '/admin/rooms', icon: Building, label: 'Quản lý phòng khám' },
    { to: '/admin/services', icon: Stethoscope, label: 'Quản lý dịch vụ' },
    { to: '/admin/doctors', icon: UserCheck, label: 'Quản lý bác sĩ' },
    { to: '/admin/patients', icon: Users, label: 'Quản lý bệnh nhân' },
    { to: '/admin/appointments', icon: Calendar, label: 'Quản lý lịch hẹn' },
  ];

  // Menu Doctor (Hình 3.8, 3.11)
  const doctorLinks = [
    { to: '/doctor/examination', icon: Stethoscope, label: 'Khám bệnh & Kê đơn' },
    { to: '/doctor/queue', icon: Users, label: 'Danh sách bệnh nhân' },
    { to: '/doctor/schedule', icon: Clock, label: 'Cập nhật mẫu lịch khám' },
  ];

  // Menu Patient (Hình 3.13 -> 3.18)
  const patientLinks = [
    { to: '/patient/booking', icon: Calendar, label: 'Đặt lịch khám' },
    { to: '/patient/history', icon: History, label: 'Lịch sử khám bệnh' },
    { to: '/patient/ai-chat', icon: Bot, label: 'Trợ lý AI Triệu chứng', highlight: true },
  ];

  let currentLinks = [];
  if (role === 'ADMIN') currentLinks = adminLinks;
  else if (role === 'DOCTOR') currentLinks = doctorLinks;
  else if (role === 'PATIENT') currentLinks = patientLinks;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col flex-shrink-0 shadow-2xl">
      {/* Brand Logo MediClinic */}
      <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-800">
        <div className="w-10 h-10 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-sky-600/30">
          <ShieldPlus className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-black text-lg text-white tracking-wide">MediClinic</h1>
          <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider">Hệ thống Y Tế Thông Minh</p>
        </div>
      </div>

      {/* Danh mục Menu */}
      <div className="flex-1 py-6 px-3.5 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
          {role === 'ADMIN' ? 'Menu Quản Trị' : role === 'DOCTOR' ? 'Phân Hệ Bác Sĩ' : 'Dành Cho Bệnh Nhân'}
        </div>

        {currentLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : link.highlight
                    ? 'bg-gradient-to-r from-teal-500/20 to-sky-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
        Đồ án tốt nghiệp &copy; PTIT 2025
      </div>
    </aside>
  );
};

export default Sidebar;

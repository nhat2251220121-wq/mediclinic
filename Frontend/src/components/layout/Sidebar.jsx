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
  Receipt,
  FileText,
  ContactRound
} from 'lucide-react';
import { X } from 'lucide-react';

const Sidebar = ({ collapsed = false, mobileOpen = false, onClose = () => {} }) => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const isCollapsed = isAdmin && collapsed && !mobileOpen;

  // Menu Admin khớp 100% tài liệu đồ án (Hình 3.1 -> 3.7)
  const adminLinks = [
    { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
    { to: '/admin/medicines', icon: Pill, label: 'Quản lý thuốc' },
    { to: '/admin/specialties', icon: Layers, label: 'Quản lý chuyên khoa' },
    { to: '/admin/rooms', icon: Building, label: 'Quản lý phòng khám' },
    { to: '/admin/services', icon: Stethoscope, label: 'Quản lý dịch vụ' },
    { to: '/admin/doctors', icon: UserCheck, label: 'Quản lý bác sĩ' },
    { to: '/admin/patients', icon: Users, label: 'Quản lý bệnh nhân' },
    { to: '/admin/appointments', icon: Calendar, label: 'Quản lý lịch hẹn khám' },
    { to: '/admin/work-schedule', icon: Clock, label: 'Quản lý lịch làm' },
    { to: '/admin/invoices', icon: FileText, label: 'Quản lý hóa đơn / Viện phí' },
    { to: '/admin/dispensing', icon: Pill, label: 'Xác nhận cấp thuốc' },
  ];

  // Menu Doctor (Hình 3.8, 3.11)
  const doctorLinks = [
    { to: '/doctor/examination', icon: Stethoscope, label: 'Khám bệnh & Kê đơn' },
    { to: '/doctor/queue', icon: Users, label: 'Danh sách bệnh nhân' },
    { to: '/doctor/schedule', icon: Clock, label: 'Đăng ký lịch làm việc' },
    { to: '/doctor/profile', icon: ContactRound, label: 'Hồ sơ của tôi' },
  ];

  // Menu Patient (Hình 3.13 -> 3.18)
  const patientLinks = [
    { to: '/patient/booking', icon: Calendar, label: 'Đặt lịch khám' },
    { to: '/patient/history', icon: History, label: 'Lịch sử khám bệnh' },
  ];

  let currentLinks = [];
  if (role === 'ADMIN') currentLinks = adminLinks;
  else if (role === 'DOCTOR') currentLinks = doctorLinks;
  else if (role === 'PATIENT') currentLinks = patientLinks;

  return (
    <aside className={`${isAdmin
      ? `sticky top-0 z-50 h-screen flex-shrink-0 transition-[width,transform] duration-200 ${collapsed ? 'w-[76px]' : 'w-64'} max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-64 ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}`
      : 'w-64 min-h-screen flex-shrink-0'} bg-slate-900 text-slate-300 flex flex-col shadow-xl`}>
      {/* Brand Logo MediClinic */}
      <div className={`h-20 flex items-center ${isCollapsed ? 'justify-center px-3' : 'justify-between px-5'} gap-3 border-b border-slate-800`}>
        <div className="flex min-w-0 items-center gap-3">
        <div className="w-10 h-10 bg-sky-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-sky-600/30">
          <ShieldPlus className="w-6 h-6" />
        </div>
        {!isCollapsed && <div className="min-w-0">
          <h1 className="font-black text-lg text-white tracking-wide">MediClinic</h1>
          <p className="text-[10px] text-teal-400 font-semibold uppercase tracking-wider">Hệ thống Y Tế Thông Minh</p>
        </div>}
        </div>
        {isAdmin && mobileOpen && <button type="button" onClick={onClose} aria-label="Đóng menu" className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"><X className="h-5 w-5" /></button>}
      </div>

      {/* Danh mục Menu */}
      <div className={`flex-1 py-5 ${isCollapsed ? 'px-2' : 'px-3.5'} space-y-1 overflow-y-auto`}>
        {!isCollapsed && <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
          {role === 'ADMIN' ? 'Menu Quản Trị' : role === 'DOCTOR' ? 'Phân Hệ Bác Sĩ' : 'Dành Cho Bệnh Nhân'}
        </div>}

        {currentLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              title={isCollapsed ? link.label : undefined}
              onClick={isAdmin ? onClose : undefined}
              className={({ isActive }) =>
                `flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'} py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : link.highlight
                    ? 'bg-gradient-to-r from-teal-500/20 to-sky-500/20 text-teal-300 border border-teal-500/30 hover:bg-teal-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>{link.label}</span>}
            </NavLink>
          );
        })}
      </div>

      {!isCollapsed && <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
        Đồ án tốt nghiệp &copy; PTIT 2025
      </div>}
    </aside>
  );
};

export default Sidebar;

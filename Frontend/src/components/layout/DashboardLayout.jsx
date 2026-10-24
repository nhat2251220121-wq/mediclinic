import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';

const DashboardLayout = () => {
  const { role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleMenuClick = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMobileSidebarOpen(true);
      return;
    }
    setSidebarCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {isAdmin && mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
        />
      )}
      <Sidebar
        collapsed={isAdmin && sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      {/* Vùng nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={isAdmin ? handleMenuClick : undefined} adminMode={isAdmin} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

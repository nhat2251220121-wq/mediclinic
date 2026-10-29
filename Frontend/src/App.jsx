import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Common & Layout
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import PatientLayout from './components/layout/PatientLayout';
import HomePage from './pages/HomePage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';
import ClinicIntro from './pages/ClinicIntro';

// Patient Pages
import Booking from './pages/patient/Booking';
import MedicalHistory from './pages/patient/MedicalHistory';
import PatientProfile from './pages/patient/PatientProfile';
import AIChatSymptom from './pages/patient/AIChatSymptom';

// Doctor Pages
import ExaminationPrescription from './pages/doctor/ExaminationPrescription';
import PatientQueue from './pages/doctor/PatientQueue';
import ScheduleRegistration from './pages/doctor/ScheduleRegistration';
import DoctorProfile from './pages/doctor/DoctorProfile';

// Admin Pages (Khớp Hình 3.1 -> 3.7)
import Dashboard from './pages/admin/Dashboard';
import MedicineMgmt from './pages/admin/MedicineMgmt';
import SpecialtyMgmt from './pages/admin/SpecialtyMgmt';
import RoomMgmt from './pages/admin/RoomMgmt';
import ServiceMgmt from './pages/admin/ServiceMgmt';
import DoctorMgmt from './pages/admin/DoctorMgmt';
import PatientMgmt from './pages/admin/PatientMgmt';
import AppointmentMgmt from './pages/admin/AppointmentMgmt';
import WorkScheduleMgmt from './pages/admin/WorkScheduleMgmt';
import InvoiceMgmt from './pages/admin/InvoiceMgmt';
import DispensingMgmt from './pages/admin/DispensingMgmt';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<ClinicIntro />} />
          <Route path="/specialties" element={<Navigate to="/about#specialties" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ======================================================== */}
          {/* PHÂN HỆ BỆNH NHÂN (PATIENT)                               */}
          {/* ======================================================== */}
          <Route element={<ProtectedRoute allowedRoles={['PATIENT']} />}>
            <Route path="/patient" element={<PatientLayout />}>
              <Route index element={<Navigate to="/patient/booking" replace />} />
              <Route path="booking" element={<Booking />} />
              <Route path="history" element={<MedicalHistory />} />
              <Route path="profile" element={<PatientProfile />} />
              <Route path="ai-chat" element={<Navigate to="/patient/booking" replace />} />
            </Route>
          </Route>

          {/* ======================================================== */}
          {/* PHÂN HỆ BÁC SĨ (DOCTOR)                                  */}
          {/* ======================================================== */}
          <Route element={<ProtectedRoute allowedRoles={['DOCTOR']} />}>
            <Route path="/doctor" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/doctor/queue" replace />} />
              <Route path="examination" element={<ExaminationPrescription />} />
              <Route path="queue" element={<PatientQueue />} />
              <Route path="schedule" element={<ScheduleRegistration />} />
              <Route path="profile" element={<DoctorProfile />} />
            </Route>
          </Route>

          {/* ======================================================== */}
          {/* PHÂN HỆ QUẢN TRỊ VIÊN (ADMIN)                             */}
          {/* ======================================================== */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="medicines" element={<MedicineMgmt />} />
              <Route path="specialties" element={<SpecialtyMgmt />} />
              <Route path="rooms" element={<RoomMgmt />} />
              <Route path="services" element={<ServiceMgmt />} />
              <Route path="doctors" element={<DoctorMgmt />} />
              <Route path="patients" element={<PatientMgmt />} />
              <Route path="appointments" element={<AppointmentMgmt />} />
              <Route path="work-schedule" element={<WorkScheduleMgmt />} />
              <Route path="invoices" element={<InvoiceMgmt />} />
              <Route path="dispensing" element={<DispensingMgmt />} />
            </Route>
          </Route>

          {/* 404 Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

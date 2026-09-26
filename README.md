# 🏥 MEDICLINIC - HỆ THỐNG QUẢN LÝ PHÒNG KHÁM & ĐẶT LỊCH CÓ TRỢ LÝ AI (GEMINI)

> **Đồ án Tốt nghiệp / Dự án Chuyên ngành:** Xây dựng hệ thống quản lý phòng khám đa khoa, đặt lịch khám trực tuyến và trợ lý AI phân loại triệu chứng lâm sàng định hướng chuyên khoa.

---

## 🛠 TECH STACK (CÔNG NGHỆ SỬ DỤNG)

- **Frontend:** ReactJS (Vite) + TailwindCSS + Axios Interceptor + React Router DOM v6 + Lucide React.
- **Backend:** Node.js + Express.js + MySQL (`mysql2/promise`) + JWT + bcryptjs + Google Generative AI (Gemini API).
- **Database:** MySQL / MariaDB với đầy đủ quan hệ RDBMS, Foreign Key ràng buộc toàn vẹn dữ liệu.
- **Phân quyền người dùng (RBAC):** Gồm 3 Roles:
  - `PATIENT` (Bệnh nhân)
  - `DOCTOR` (Bác sĩ)
  - `ADMIN` (Quản trị viên / Nhân sự phòng khám)

---

## 📁 CẤU TRÚC THƯ MỤC DỰ ÁN

```text
mediclinic/
├── Backend/
│   ├── database/
│   │   └── schema.sql                # Script tạo DB MySQL, 10 bảng & dữ liệu mẫu
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # Kết nối MySQL Connection Pool
│   │   │   ├── jwt.js                # Helper tạo & giải mã JWT
│   │   │   └── ai.js                 # Tích hợp Gemini AI & Fallback Rule-based
│   │   ├── controllers/
│   │   │   ├── authController.js     # Đăng ký, Đăng nhập, Profile
│   │   │   ├── appointmentController.js # Nghiệp vụ đặt & cập nhật lịch hẹn
│   │   │   ├── doctorController.js   # Tra cứu Bác sĩ & Chuyên khoa
│   │   │   ├── medicalRecordController.js # Khám bệnh, kê đơn & bệnh án
│   │   │   ├── invoiceController.js  # Hóa đơn & thu ngân viện phí
│   │   │   └── aiController.js       # Phân loại triệu chứng bằng AI
│   │   ├── middlewares/
│   │   │   ├── verifyToken.js        # Xác thực Bearer JWT
│   │   │   ├── checkRole.js          # RBAC (isAdmin, isDoctor, isPatient)
│   │   │   └── errorHandler.js       # Xử lý lỗi tập trung & 404
│   │   ├── routes/                   # Định tuyến API modular
│   │   └── server.js                 # Entry point Backend Express
│   ├── .env
│   ├── .env.example
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── api/
    │   │   └── axiosClient.js        # Axios đính kèm Bearer Token tự động
    │   ├── context/
    │   │   └── AuthContext.jsx       # Quản lý phiên đăng nhập & Role
    │   ├── components/
    │   │   ├── common/               # ProtectedRoute, Modal, StatusBadge
    │   │   └── layout/               # Header, Sidebar, DashboardLayout
    │   ├── pages/
    │   │   ├── auth/                 # Login (có nút 1-click Demo), Register
    │   │   ├── patient/              # AIChatSymptom, Booking, MedicalHistory
    │   │   ├── doctor/               # PatientQueue, ExaminationPrescription, ScheduleRegistration
    │   │   ├── admin/                # Dashboard, Appointment, Patient, Doctor, Service, Medicine, Invoice
    │   │   ├── HomePage.jsx          # Trang chủ giới thiệu
    │   │   ├── Unauthorized.jsx      # Báo lỗi 403
    │   │   └── NotFound.jsx          # Báo lỗi 404
    │   ├── App.jsx                   # Cấu hình Router & ProtectedRoute RBAC
    │   ├── main.jsx
    │   └── index.css
    ├── tailwind.config.js
    ├── vite.config.js
    ├── .env
    ├── .env.example
    └── package.json
```

---

## 🗄 HỆ THỐNG CƠ SỞ DỮ LIỆU (10 BẢNG)

1. `Users` (id, full_name, email, password_hash, phone, gender, role [PATIENT, DOCTOR, ADMIN])
2. `Specialties` (id, name, description)
3. `Rooms` (id, room_number, name, note)
4. `Doctors` (id, user_id, specialty_id, room_id, bio, experience_years, consultation_fee)
5. `Services` (id, name, price, description)
6. `Medicines` (id, name, unit, price, stock_quantity, usage_guide)
7. `Appointments` (id, patient_id, doctor_id, appointment_date, time_slot, status, initial_symptoms, ai_predicted_specialty)
8. `MedicalRecords` (id, appointment_id, doctor_id, patient_id, diagnosis, advice, re_examination_date)
9. `PrescriptionDetails` (id, record_id, medicine_id, quantity, dosage, usage_instruction)
10. `Invoices` (id, appointment_id, patient_id, service_fee, medicine_fee, total_amount, payment_status, payment_method)

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY DỰ ÁN

### Bước 1: Import Cơ Sở Dữ Liệu
Mở file `Backend/database/schema.sql` trong **MySQL Workbench** và nhấn biểu tượng ⚡ để chạy.

---

### Bước 2: Khởi chạy Backend Server
1. Mở terminal tại thư mục `Backend`:
   ```bash
   cd d:\doanphongkham\Backend
   npm run dev
   ```
   *(Server API chạy tại: `http://localhost:5000`)*

---

### Bước 3: Khởi chạy Frontend Client
1. Mở terminal tại thư mục `Frontend`:
   ```bash
   cd d:\doanphongkham\Frontend
   npm run dev
   ```
   *(Giao diện ứng dụng chạy tại: `http://localhost:3000`)*

---

## 👥 TÀI KHOẢN TRẢI NGHIỆM NHANH (DEMO ACCOUNTS)

Trên trang Đăng nhập (`/login`), bạn có thể **click trực tiếp vào các nút Demo 1-chạm** để đăng nhập ngay mà không cần gõ phím:

| Vai trò | Số điện thoại (Tài khoản) | Mật khẩu | Chức năng nổi bật |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (ADMIN)** | `0987654321` *(hoặc admin@mediclinic.com)* | `password123` | Dashboard thống kê doanh thu, quản lý thuốc, chuyên khoa, phòng khám, bác sĩ, bệnh nhân |
| **Bác sĩ (DOCTOR)** | `0912345678` *(hoặc doctor.an@mediclinic.com)* | `password123` | Khám bệnh, nhập 6 chỉ số sinh hiệu, chẩn đoán ICD-10, kê đơn thuốc, in phiếu khám bệnh |
| **Bệnh nhân (PATIENT)** | `0912325678` *(hoặc nghia.nguyen@gmail.com)* | `password123` | Đặt lịch khám, thanh toán VNPAY, xem bệnh án, Chatbot AI tư vấn 24/7 |

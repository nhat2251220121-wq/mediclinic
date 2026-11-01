# MediClinic — PROJECT_CONTEXT

**Tài liệu bàn giao cho chat/Codex mới.** Lập ngày **01/11/2026** từ source và tài liệu trong workspace. Đây là ảnh chụp trạng thái tại ngày lập; code, database và tài liệu có thể thay đổi. Hãy kiểm tra lại trước khi tư vấn hoặc sửa.

## 1. Thông tin dự án

- **Đề tài:** Website quản lý phòng khám và đặt lịch có trợ lý AI phân loại triệu chứng; đồ án cá nhân tại Trường Đại học Kiến trúc Đà Nẵng.
- **Mục tiêu:** Bệnh nhân tra cứu/đặt lịch; bác sĩ khám và kê đơn; Admin quản lý vận hành, thu tiền, cấp thuốc và xử lý hủy/hoàn.
- **Công nghệ:** React 18, Vite, React Router, Tailwind; Node.js/Express REST API, Socket.IO; MySQL/mysql2; JWT; SePay QR/webhook; OpenAI Responses API server-side.
- **Thư mục chính:** `Frontend/`, `Backend/`, `docs/`. `server/` hiện chỉ có `.env.example`, chưa thấy ứng dụng/deployment riêng.
- Backend khai báo Node `>=18`; README yêu cầu Node 20+ và ghi môi trường đã build với Node 24.14.0 (thông tin tài liệu, chưa kiểm tra lại trong lượt này).

### Cấu hình

Tên biến có trong `.env.example` (không ghi giá trị):

- Backend: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `FRONTEND_URL`, `EMAIL_USER`, `EMAIL_PASS`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `SEPAY_API_KEY`, `BANK_NAME`, `BANK_ACCOUNT`, `ACCOUNT_NAME`, `BOOKING_SLOT_MINUTES`, `REFUND_PII_ENCRYPTION_KEY`.
- Frontend: `VITE_API_BASE_URL`, `VITE_UPLOADS_BASE_URL`, `VITE_CLINIC_ADDRESS`, `VITE_CLINIC_PHONE`, `VITE_CLINIC_EMAIL`.
- Không đọc/chép giá trị từ `.env`; không đưa API key, mật khẩu, OTP, dữ liệu bệnh nhân hoặc tài khoản ngân hàng vào tài liệu này.

## 2. Cấu trúc code và luồng request

### Frontend

- `Frontend/src/App.jsx`: route public và route có guard theo `ADMIN`, `DOCTOR`, `PATIENT`.
- `Frontend/src/api/`: Axios client và Socket.IO client.
- `Frontend/src/context/AuthContext.jsx`: phiên đăng nhập và thông tin user.
- `Frontend/src/components/common/`: guard, modal thanh toán, chuông thông báo bệnh nhân, chatbot, trạng thái và ảnh dự phòng.
- `Frontend/src/components/layout/`: header, sidebar, layout Admin/Bác sĩ và layout bệnh nhân.
- `Frontend/src/pages/auth/`: đăng nhập, đăng ký, quên mật khẩu.
- `Frontend/src/pages/patient/`: đặt lịch, lịch sử/bệnh án, hồ sơ, trợ lý AI.
- `Frontend/src/pages/doctor/`: hàng đợi, khám/kê đơn, đăng ký lịch, hồ sơ bác sĩ.
- `Frontend/src/pages/admin/`: dashboard; thuốc/cấp phát; chuyên khoa/phòng/dịch vụ; bác sĩ/bệnh nhân; lịch hẹn/lịch làm; hóa đơn.
- `Frontend/src/index.css`: CSS nền tảng. Có ảnh tĩnh `Frontend/public/assets/clinic-consultation.jpg`; ảnh tải lên được phục vụ từ `Backend/uploads/`.
- `Frontend/index.html` là entry SPA. Không thấy demo HTML độc lập; `Frontend/dist/` là output build, không phải source.

Route chính tại `Frontend/src/App.jsx`:

| Vai trò | Route |
|---|---|
| Public | `/`, `/about`, `/login`, `/register`, `/forgot-password`, `/ai-symptom` |
| PATIENT | `/patient/booking`, `/patient/history`, `/patient/profile`, `/patient/ai-chat` |
| DOCTOR | `/doctor/queue`, `/doctor/examination`, `/doctor/schedule`, `/doctor/profile` |
| ADMIN | `/admin/dashboard`, `/admin/medicines`, `/admin/specialties`, `/admin/rooms`, `/admin/services`, `/admin/doctors`, `/admin/patients`, `/admin/appointments`, `/admin/work-schedule`, `/admin/invoices`, `/admin/dispensing` |

### Backend

- `Backend/src/server.js`: Express/Socket.IO, CORS, JSON, static `/uploads`, gắn `/api`, health và xử lý lỗi. **Quan trọng:** khi start, `startServer()` gọi `testConnection()` rồi `runMigrations()` trước `listen()`. Không khởi động backend nếu cấu hình có thể trỏ vào `mediclinic_db`.
- `Backend/src/routes/index.js`: gắn `/auth`, `/ai`, `/appointments`, `/doctors`, `/medical-records`, `/invoices`, `/payments`, `/admin`, `/notifications`; có `GET /api/health`.
- `Backend/src/middlewares/verifyToken.js`: xác minh Bearer JWT, đọc user/role/`is_active` từ DB. `checkRole.js` kiểm tra role; `rateLimit.js`, `imageUpload.js`, `errorHandler.js` xử lý giới hạn, upload, lỗi.
- `Backend/src/controllers/`: `authController`, `emailOtpController`, `passwordResetController`, `appointmentController`, `cancellationController`, `paymentController`, `invoiceController`, `doctorController`, `medicalRecordController`, `notificationController`, `adminMgmtController`, `adminScheduleController`, `aiController`.
- `Backend/src/config/`: DB pool, JWT, OpenAI/schema/fallback. `Backend/src/utils/`: lưu ảnh, thông báo hóa đơn, mã hóa thông tin nhận hoàn.
- `Backend/scripts/webhook-gateway.js`: gateway phát triển giới hạn route; xem `docs/WEBHOOK-GATEWAY.md`. Không phải cấu hình VPS/production.

```text
React page/component
  → axiosClient (Bearer token nếu cần)
  → Express /api route
  → verifyToken + checkRole (nếu route yêu cầu)
  → controller kiểm tra dữ liệu/quyền sở hữu
  → mysql2 pool; transaction/row lock khi nghiệp vụ cần
  → JSON response; có thể phát Socket.IO sau commit
  → React cập nhật trạng thái/danh sách
```

Webhook SePay không dùng JWT nhưng phải có `Authorization: Apikey …`; controller kiểm tra giao dịch. AI là public và không lưu nội dung triệu chứng vào DB.

## 3. Vai trò và giới hạn quyền

- **PATIENT:** đăng ký qua email OTP, đăng nhập, xem/cập nhật hồ sơ của mình, xem danh mục/bác sĩ, đặt/hủy lịch, xem bệnh án/đơn/hóa đơn/thông báo của mình; yêu cầu tiền mặt hoặc xem QR theo phương thức hóa đơn. Backend lọc theo user ID.
- **DOCTOR:** xem lịch được phân công, xem bệnh nhân/hồ sơ trong phạm vi controller, lưu bệnh án/đơn/tái khám, quản lý lịch và hồ sơ của mình. Không cấp thuốc, thu tiền hoặc xác nhận lịch bằng endpoint trạng thái chung.
- **ADMIN:** quản lý danh mục, bác sĩ, bệnh nhân, lịch hẹn/lịch làm, hóa đơn, thuốc/tồn; xác nhận tiền mặt sau khi nhận thật; xử lý hủy/hoàn thủ công và NO_SHOW. `adminRoutes` áp dụng token và `isAdmin` cho toàn router.
- Frontend guard chỉ hỗ trợ điều hướng; phân quyền bắt buộc ở backend.

## 4. Database và quan hệ

`Backend/database/schema.sql` khai báo **28 bảng** và có `CREATE DATABASE`/`USE mediclinic_db`. Không chạy file này trên DB đang có dữ liệu. Migration `001_email_verifications.sql` tạo thêm `email_verifications`; `schema_migrations` do runner tạo. `password_reset_otps` có trong schema tổng hợp và migration `014`.

### Nhóm bảng trong schema.sql

- Tài khoản/danh mục: `users`, `specialties`, `rooms`, `doctors`, `services`.
- Lịch/slot: `shifts`, `shift_day_employee`, `shift_employee`, `shift_time_slots`, `appointments`.
- Hóa đơn/thu tiền: `invoices`, `invoice_items`, `payments`.
- Khám/đơn: `appointment_records`, `prescriptions`, `prescription_times`, `follow_up_visits`, `icd10_codes`, `units`, `dosage_times`, `meal_relations`.
- Thuốc/kho: `drugs`, `drug_batches`, `stock_movements`.
- Thông báo: `notifications`.
- Hủy/hoàn: `appointment_cancellation_requests`, `appointment_refunds`.
- OTP reset: `password_reset_otps`; OTP đăng ký trong `email_verifications`.

### Quan hệ quan trọng

- `doctors.user_id → users.id` (hồ sơ bác sĩ gắn tài khoản); bác sĩ có `specialty_id → specialties.id`, `room_id → rooms.id`.
- `services.specialty_id → specialties.id`; dịch vụ cũ có thể chưa gán khoa. Backend booking từ chối dịch vụ thiếu khoa/khoa ngừng và kiểm tra bác sĩ thuộc khoa dịch vụ.
- `shift_day_employee` gắn bác sĩ-ngày; `shift_employee` gắn ngày-ca; `shift_time_slots` là slot cụ thể. `appointments.slot_id` có unique key để chống đặt trùng.
- `appointments` liên kết bệnh nhân/bác sĩ/dịch vụ/slot. `appointment_records.appointment_id` unique: tối đa một bệnh án mỗi lịch; prescriptions và follow-up tham chiếu bệnh án.
- `invoices.appointment_id` unique; `invoice_items` lưu dòng phí dịch vụ/thuốc; `payments` lưu nhiều giao dịch, unique provider + transaction ID chống lặp.
- `invoice_items.item_reference_id` là **liên kết logic** đến service/drug theo `item_type`; schema không khai báo FK đến các bảng đó. `appointments.service_id` là FK thật.
- `drug_batches` thuộc thuốc; `stock_movements` lưu nhập/xuất và batch ID; cấp thuốc trừ tồn theo lô.
- `appointment_cancellation_requests` liên kết lịch/hóa đơn/bệnh nhân; `appointment_refunds` tham chiếu yêu cầu và payment gốc. `notifications` thuộc user, có dedupe key unique và FK tới lịch/hóa đơn khi liên quan.

### Migration và dữ liệu

- Migration trong `Backend/database/migrations/`, source hiện có `001`–`014`; mới nhất là `014_password_reset_otps.js`. Điều này **không chứng minh migration nào đã chạy trên DB**.
- `Backend/database/migrate.js` chạy theo thứ tự và ghi `schema_migrations`; `Backend/src/server.js` cũng tự gọi runner khi start.
- Migration cần backup, xác nhận đúng DB đích, thử trên DB tách riêng. Không chạy migration, import schema hoặc DML trên `mediclinic_db`.
- Integration test hardcode DB `mediclinic_cancel_test_20261031_a1`, yêu cầu migration liên quan có sẵn và tự kiểm tra `SELECT DATABASE()`. Chưa xác minh DB đó hiện tồn tại/kết nối được.
- Ảnh upload nằm trong `Backend/uploads/`; backup ảnh cùng DB vì DB chỉ lưu đường dẫn.

## 5. Quy tắc nghiệp vụ theo tài liệu và code

### Đặt lịch và phí

- Bệnh nhân gửi dịch vụ, bác sĩ, ngày, slot, triệu chứng và phương thức thanh toán. Backend kiểm tra user/bác sĩ/dịch vụ/khoa hoạt động, bác sĩ đúng khoa, ngày giờ tương lai và slot trống.
- Lịch mới là `PENDING`; giữ slot trong transaction/lock, unique `appointments.slot_id` là lớp chống đặt trùng.
- Hóa đơn lúc booking chụp phí dịch vụ tại thời điểm đặt. Giá dịch vụ đổi sau không làm thay đổi dòng hóa đơn cũ.
- Quy tắc đã chốt: lịch chỉ `CONFIRMED` khi thu đủ **phí dịch vụ khám**. Lúc booking hóa đơn mới có phí dịch vụ; QR webhook hoặc Admin xác nhận tiền mặt đủ sẽ xác nhận lịch.
- Phí thuốc phát sinh sau khám. Hóa đơn còn nợ tiền thuốc không đưa lịch `COMPLETED` về `PENDING`.

### Thanh toán và thuốc

- QR tạo theo số còn thiếu, nội dung dự kiến `MEDICLINIC<appointmentId>`; chỉ webhook được xác thực mới ghi nhận QR. Kiểm tra key, tài khoản nhận, inbound, mã liên kết, amount và ID giao dịch.
- Tiền mặt là yêu cầu chờ; chỉ Admin xác nhận sau khi nhận thật. Backend khóa hóa đơn và so sánh số còn thiếu trước khi ghi giao dịch.
- Khi bác sĩ lưu đơn, backend lấy giá thuốc trong danh mục, lưu đơn giá snapshot và lập các dòng MEDICINE cho thuốc phòng khám cấp. Thiếu giá hợp lệ thì từ chối; thuốc mua ngoài không tính hóa đơn và không trừ kho.
- Giao thuốc là bước riêng. Hóa đơn phải được thanh toán đủ trước khi trừ kho; code dùng lô còn hạn, FEFO và stock movement. Cấp phát lặp được chặn bởi trạng thái/transaction.
- Không gửi giao dịch thật, không gọi webhook production. README ghi VNPay không còn được khởi tạo; không thấy API VNPay trong routes đã rà.

### Hủy, hoàn tiền và NO_SHOW

- Controller hiện dùng mốc **2 giờ**; một số đoạn SRS/HLD cũ ghi 24 giờ. Cần chủ dự án xác nhận quy tắc chuẩn.
- Trước mốc 2 giờ và chưa thanh toán, bệnh nhân có thể tự hủy; trường hợp đã trả hoặc trong 2 giờ cuối cần Admin xử lý. Yêu cầu `PENDING` giữ lịch/slot; Admin duyệt mới hủy và nhả slot.
- Hủy và hoàn tiền là hai bước. Admin xác nhận hoàn sau khi thực trả; chuyển khoản cần reference, tiền mặt cần note. Không có hoàn SePay tự động.
- Admin đánh dấu `NO_SHOW` sau ít nhất 15 phút và xác nhận bệnh nhân vắng. Code hiện chặn nếu còn yêu cầu hủy `PENDING`; không thấy auto-close/escalation.

### AI

- `POST /api/ai/classify-symptom` public, rate limit 10/phút, chỉ nhận `symptoms` tối đa 2.000 ký tự. Backend kiểm tra cấp cứu trước model; `EMERGENCY` đặt `booking_allowed=false`, UI ẩn tiếp tục đặt lịch thông thường.
- Backend gọi OpenAI Responses API server-side, model mặc định `gpt-5.4-mini`; kiểm tra JSON schema và specialty đang hoạt động, lỗi thì dùng rule fallback.
- Không chẩn đoán/kê đơn, không trả `possible_conditions`, không lưu triệu chứng/hội thoại. Key/runtime thật chưa xác minh; unit test dùng provider stub.

## 6. Tình trạng hiện tại

“Đã triển khai” nghĩa là thấy implementation trong source, không đồng nghĩa đã nghiệm thu hoặc đã chạy với DB thật.

| Hạng mục | Trạng thái | Bằng chứng | Việc còn lại |
|---|---|---|---|
| Đăng ký OTP, login, JWT/role, profile | Đã triển khai source | `authRoutes.js`, `emailOtpController.js`, `authController.js`, middleware auth, `Register.jsx`, `Login.jsx` | DB/mail integration chưa xác minh trong lượt này. |
| Quên mật khẩu OTP | Đã triển khai source; runtime chưa xác minh | `passwordResetController.js`, `ForgotPassword.jsx`, migration `014`, `password-reset-db.integration.js` | Chạy test trên DB test với mail stub; DB test trước đó bị EACCES. |
| Đặt lịch/slot/validate khoa | Đã triển khai source | `Booking.jsx`, `appointmentController.js`, `doctorController.js`, migration `005`,`007` | Chạy integration cạnh tranh slot, profile và booking UI trên test DB. |
| Dịch vụ–chuyên khoa–bác sĩ | Triển khai một phần | `services.specialty_id`, migration `007`, `ServiceMgmt.jsx`, validate trong booking | Dịch vụ cũ `specialty_id=NULL` cần Admin gán; README vẫn ghi quan hệ cần hoàn thiện. |
| QR/tiền mặt/hóa đơn Admin | Đã triển khai source; integration chưa xác minh | `paymentController.js`, `invoiceController.js`, `InvoiceMgmt.jsx`, `AppointmentMgmt.jsx`, `PaymentModal.jsx` | Không chạy SePay thật; giao diện hiện tách nút theo phương thức trong source nhưng chưa browser-test; xem rủi ro mục 7. |
| Hủy/hoàn thủ công/NO_SHOW | Đã triển khai source; test DB bị chặn trước đây | `cancellationController.js`, migration `013`, `cancellation-db.integration.js` | Chạy lại integration; xác nhận 2 giờ/24 giờ và pending request qua giờ khám. |
| Bệnh án/đơn/tái khám | Đã triển khai source | `medicalRecordController.js`, `ExaminationPrescription.jsx`, `PatientQueue.jsx`, `MedicalHistory.jsx` | API/DB và UI thực tế chưa được kiểm thử lại. |
| Lô thuốc/hạn/FEFO/cấp phát | Đã triển khai source | `drug_batches`, `stock_movements`, migrations `002`,`012`, `DispensingMgmt.jsx` | Test hết hạn, thiếu tồn, rollback, cấp lặp và tồn âm trên DB test. |
| Thông báo/Socket.IO | Đã triển khai source | `notificationController.js`, `invoiceNotifications.js`, `notificationRoutes.js`, `PatientNotificationBell.jsx` | Chưa xác minh realtime, ownership, dedupe, reconnect với backend chạy. |
| AI Gemini → OpenAI | Đã chuyển trong source; live chưa xác minh | `Backend/src/config/ai.js`, `aiController.js`, `aiRoutes.js`, `AIChatSymptom.jsx`, `ai-classification.test.js` | Không gọi OpenAI thật; không thấy bộ benchmark 50 ca, chưa có accuracy/confusion matrix. |
| Admin schedule/dashboard | Có page/API trong source; runtime chưa xác minh | `WorkScheduleMgmt.jsx`, `adminScheduleController.js`, `Dashboard.jsx`, `/api/admin/dashboard-stats` | README nói vài phần còn thiếu; cần xác minh API/data và thống kê qua DB test. |
| VPS/domain/production | Chưa xác minh | Không thấy bằng chứng deploy trong source rà soát; `server/` chỉ có `.env.example` | Cần thông tin môi trường thật; gateway là dev-only. |
| Demo HTML/ảnh responsive | Chưa thấy demo HTML độc lập; responsive E2E chưa chạy | `Frontend/index.html`, `Frontend/public/assets/clinic-consultation.jpg`; upload ảnh ở `Backend/uploads/` | Chưa thấy bộ ảnh nghiệm thu responsive. `dist/` là output build. |

## 7. Kiểm thử và điểm cần xác minh

### Lệnh trong package.json

- Backend unit: `npm test` → `node --test test/*.test.js`.
- DB integration: `npm run test:cancellation-db`, `npm run test:password-reset-db`; cần database đúng tên test có migrations liên quan. Các test có dữ liệu giả, không tự migrate.
- `npm start`/`npm run dev` khởi động backend; `npm run migrate` áp dụng migration theo DB config. **Không chạy nếu có thể trỏ vào `mediclinic_db`.**
- Frontend: `npm run build`, `npm run dev`, `npm run preview`. Không có script test frontend.

### Báo cáo kiểm thử trước đây (không chạy lại trong lượt tạo tài liệu)

- Báo cáo rà soát gần nhất ghi Backend unit **17/17 PASS**, `node --check` cho controller liên quan **PASS**, Frontend build **PASS** nhưng có cảnh báo bundle >500 KB.
- Cũng báo cáo kết nối read-only tới `mediclinic_cancel_test_20261031_a1` bị `EACCES`; API/integration DB **BLOCKED**. Backend không khởi động, không migration, không ghi `mediclinic_db`.
- Báo cáo cũ khác (không rõ ngày) ghi unit **4/4** và integration **PASS** trên DB test; báo cáo sau không xác minh lại được. Không gộp thành kết luận integration đã đạt.
- OpenAI thật, SePay sandbox/live, browser E2E, responsive 320/360/390/768 px và AI benchmark 50 ca: **chưa chạy/chưa xác minh**.
- Trong lượt lập context này chỉ đọc source/docs/packages; không chạy test/build/backend/migration.

### Source-level cần tái hiện — chưa phải lỗi runtime đã xác nhận

1. **Đổi QR sang tiền mặt khi webhook chờ:** cash request đổi invoice sang CASH; webhook từ chối nếu phương thức hiện tại không còn BANK_TRANSFER trước khi ghi payment. Cần test giao dịch đến sau lúc đổi phương thức.
2. **Nội dung webhook:** `paymentController.js` tìm `MEDICLINIC<ID>` bằng regex trong `code`, `content` hoặc `description`, chưa bắt toàn nội dung khớp chính xác mã QR.
3. **QR trả dư:** webhook ghi payment `PAID`/`OVERPAID`; tổng đã thu có thể làm invoice `PAID` và lịch `CONFIRMED`. Không có hoàn tự động; cần chốt đối soát phần dư.
4. **Gửi lại OTP khi email lỗi:** mã OTP cũ bị consumed trước khi email mới gửi thành công; khi mail lỗi mã mới bị xóa. Cần test mailer lỗi/retry.
5. **NO_SHOW khi cancellation pending:** `markNoShow` từ chối nếu lịch còn yêu cầu `PENDING`; không thấy auto-close/escalation.
6. **Nút thanh toán Admin:** source `InvoiceMgmt.jsx` hiện chỉ hiện xác nhận tiền mặt cho CASH và QR cho BANK_TRANSFER; chưa browser-test. Ảnh/báo cáo cũ nói nút lẫn, cần so phiên bản/build thực tế nếu gặp lại.
7. **Ngày/giờ hóa đơn:** `InvoiceMgmt.jsx` đang thêm `00:00` vào ngày khám, trong khi giờ nằm ở `appointments.time_slot`; API hóa đơn hiện chỉ trả ngày, chưa trả slot.

### Sai khác giữa README, SRS/HLD và code

- Source có migrations `001–014`; vài đoạn DOCX/SRS/HLD mô tả snapshot `001–011` hoặc trạng thái cũ như chưa có NO_SHOW. Không dùng mô tả cũ làm bằng chứng runtime.
- Một số đoạn SRS/HLD nêu hủy trước 24 giờ; controller hiện dùng 2 giờ. Cần xác nhận chính sách chuẩn.
- README nói lọc dịch vụ theo khoa và lịch Admin còn cần hoàn thiện; source đã có `specialty_id`, API/routes và trang Admin, nhưng legacy NULL/data/runtime chưa xác minh.
- README ghi VNPay không còn được khởi tạo; routes hiện rà soát có SePay/VietQR, không thấy VNPay.
- Benchmark 50 ca là kế hoạch/nhãn nháp trong tài liệu; `Backend/test/` có unit stub, không thấy tập 50 ca hoặc kết quả accuracy/confusion matrix.
- HLD có đoạn dặn không mặc định server auto-migrate; `server.js` hiện gọi `runMigrations()` khi start. Source là căn cứ hành vi hiện tại.

## 8. Hướng dẫn cho chat/Codex lần sau

1. Đọc `PROJECT_CONTEXT.md` trước, sau đó kiểm tra source vì file có thể cũ.
2. Trước khi sửa, nêu file/API/luồng bị ảnh hưởng; phân biệt SRS mục tiêu với code hiện tại.
3. Không in/chép nội dung `.env`; chỉ dùng tên biến.
4. Không chạy `schema.sql`, migration, backend hoặc test ghi DB nếu chưa xác nhận DB test riêng. Server tự chạy migration lúc start.
5. Không gọi OpenAI thật, SePay production, gửi tiền/OTP thật hoặc replay webhook khi chưa được yêu cầu rõ; dùng stub/sandbox.
6. Quy tắc chưa chốt phải hỏi/đề xuất trước, không suy đoán.
7. Sau khi được phép sửa, chạy test/build phù hợp; ghi PASS/FAIL/BLOCKED/CHƯA CHẠY trung thực. Build pass không đồng nghĩa nghiệm thu toàn luồng.
8. Không commit/push nếu chưa được yêu cầu.

## 9. Mục cần chủ dự án xác nhận

- DB test `mediclinic_cancel_test_20261031_a1` còn tồn tại/được phép dùng không; trạng thái migration của nó là gì?
- Chính sách hủy chuẩn là 2 giờ hay 24 giờ? Nếu cancellation còn pending khi đến giờ khám, Admin xử lý NO_SHOW và yêu cầu ra sao?
- QR trả dư: giữ trạng thái đối soát thế nào, có xác nhận lịch không, xử lý hoàn phần dư ra sao?
- Phương thức được đổi QR/tiền mặt khi QR đang chờ không; nếu đổi, làm gì với tiền đến muộn?
- Payload SePay test thực tế đặt memo ở field nào và quy tắc match chính xác là gì?
- Bộ 50 ca AI ở đâu, ai rà nhãn và nhãn đã đủ tin cậy chưa?
- VPS/domain/production đã triển khai chưa; có môi trường test an toàn không?
- Có cần cập nhật SRS/HLD để thống nhất với code và chính sách hiện tại không?
# MediClinic

Ứng dụng quản lý phòng khám gồm React/Vite/TailwindCSS, Express, MySQL, JWT và Socket.IO.

## Chức năng hiện có

- Đăng ký bệnh nhân cần xác thực email OTP; đăng nhập không dùng tài khoản demo.
- Danh mục bác sĩ, chuyên khoa và dịch vụ được tải từ API.
- Bác sĩ đăng ký nhiều ca trong tuần; mỗi ca được chia thành khung khám `BOOKING_SLOT_MINUTES` (mặc định 30 phút). Khung giờ được khóa trong transaction; hủy lịch giải phóng đúng khung giờ và giữ lịch sử.
- Bác sĩ chỉ mở lịch được phân công, ghi bệnh án, sinh hiệu, ICD-10, đơn thuốc và hướng dẫn tái khám.
- Bác sĩ chọn nhiều ngày từ thứ Hai đến Chủ nhật, áp dụng ca trong database rồi điều chỉnh từng ngày; toàn bộ tuần được lưu trong một transaction theo giờ `Asia/Ho_Chi_Minh`.
- Khi bác sĩ lưu bệnh án, backend kiểm tra giá thuốc trong danh mục, lưu đơn giá snapshot và lập từng dòng thuốc trên hóa đơn trong cùng transaction. Nếu thuốc chưa có giá dương hợp lệ, yêu cầu lưu bị từ chối; hệ thống không tự đặt giá.
- Giao thuốc là bước riêng chỉ cập nhật tồn kho. Hóa đơn phải được thanh toán đủ trước khi trừ kho; các đơn cũ chưa lập phí được xử lý một lần từ giá snapshot đã lưu, còn snapshot bằng 0 cần admin kiểm tra.
- Mỗi lịch có một hóa đơn với dòng phí dịch vụ và thuốc, nhiều giao dịch, tổng đã thu và số còn thiếu. Tiền mặt bệnh nhân chọn được lưu là đang chờ tại quầy; chỉ ADMIN xác nhận tiền thực nhận mới tạo giao dịch PAID. QR chỉ được xác nhận từ webhook SePay đã xác thực.
- Thu tiền mặt yêu cầu ADMIN và đối chiếu lại số còn thiếu trước khi ghi nhận. Chuyển khoản được xác nhận từ webhook SePay đã xác thực; giao dịch lặp được chống bằng mã nhà cung cấp. VNPay không còn được khởi tạo hoặc xử lý; bản ghi lịch sử được giữ nguyên.
- Admin quản lý danh mục, bệnh nhân, bác sĩ và tài khoản bác sĩ. Danh mục đã dùng được ngừng hoạt động thay vì xóa lịch sử.

## Chuẩn bị môi trường

1. Cài Node.js 20+ và MySQL 8+ (đã build với Node.js 24.14.0 và Vite 6.4.3).
2. Tạo database mới bằng `Backend/database/schema.sql`. File này chỉ dùng cho database mới và không chứa lệnh DROP hay tài khoản mẫu.
3. Sao lưu database đang có trước khi nâng cấp. Ví dụ, `mysqldump -u <user> -p mediclinic_db > mediclinic_db-backup.sql`; lệnh sẽ hỏi mật khẩu.
4. Sao chép `Backend/.env.example` thành `Backend/.env`, điền thông tin database và tạo `JWT_SECRET` ngẫu nhiên dài ít nhất 32 ký tự. Không commit `.env`.
5. Tùy chọn, chỉ trên database phát triển mới: chạy `Backend/database/seed-dev.sql` để thêm ca làm, dịch vụ và danh mục minh họa. File seed không tạo tài khoản hoặc dữ liệu bệnh nhân.
6. Cài dependency và áp dụng migration:

   ```powershell
   cd Backend
   npm install
   npm run migrate
   npm run create-admin
   npm run dev
   ```

Migration `011_invoice_prescription_billing_and_cash_request.js` bổ sung trạng thái đã/chưa lập phí cho từng đơn thuốc và thời điểm bệnh nhân yêu cầu tiền mặt. Đây là migration cộng thêm, không backfill hay sửa hóa đơn/giao dịch cũ. Trước khi chạy trên bất kỳ database đã có dữ liệu nào, hãy sao lưu và áp dụng trước trên database thử riêng; các đơn thuốc đang chờ cũ sẽ mặc định `UNBILLED` và chỉ được lập phí một lần từ đơn giá snapshot. Không chạy migration trong phiên làm việc này.

   `npm run create-admin` chỉ dùng khi database chưa có ADMIN. Tạo mật khẩu riêng, tối thiểu 12 ký tự.

7. Sao chép `Frontend/.env.example` thành `Frontend/.env`, kiểm tra `VITE_API_BASE_URL`, rồi chạy:

   ```powershell
   cd Frontend
   npm install
   npm run dev
   ```

   Khi frontend và backend chạy khác origin, đặt `VITE_UPLOADS_BASE_URL` là origin backend để tải ảnh trong `/uploads`.

## Migration và dữ liệu

- Migration nằm trong `Backend/database/migrations/`, có tiền tố số, chạy theo thứ tự và được ghi vào `schema_migrations`. Server chỉ áp dụng phiên bản chưa chạy; lỗi migration dừng khởi động thay vì bị bỏ qua.
- Migration hiện bổ sung xác minh OTP lưu bền vững, trạng thái hoạt động, liên kết thanh toán-hóa đơn, dòng hóa đơn, lịch sử tồn kho, ảnh bác sĩ, trạng thái cấp thuốc, thu ngân, thông báo và khung giờ khám con cho ca. Migration `005_appointment_time_slots.js` chỉ backfill ca chưa có lịch hẹn; lịch hẹn cũ giữ nguyên ngày/giờ, không bị chuyển. Ca legacy đang có lịch sẽ không mở khung mới chồng lên.
- Đặt `BOOKING_SLOT_MINUTES=30` trong `Backend/.env` nếu muốn đổi độ dài slot; ca không chia hết theo giá trị cấu hình sẽ bị từ chối khi đăng ký và migration bỏ qua khi backfill, cần điều chỉnh lịch/giá trị cấu hình trước.
- Trước khi cập nhật ứng dụng, dừng các phiên bản backend cũ, sao lưu đầy đủ MySQL và chạy `npm run migrate`. Không chạy `schema.sql` trên database đang có dữ liệu.
- Ảnh tải lên nằm trong `Backend/uploads/`; cần sao lưu/khôi phục thư mục này cùng bản sao MySQL vì database chỉ lưu đường dẫn tương đối.
- Tài khoản, lịch khám, bệnh án, đơn thuốc và hóa đơn phải được lưu giữ. Không xóa trực tiếp các bảng hoặc xóa lịch sử giao dịch.

## Cấu hình tích hợp

Tham khảo `Backend/.env.example`. Các biến email OTP, Gemini và ngân hàng/SePay chỉ cần đặt khi bật các tích hợp tương ứng. Gemini dùng `GEMINI_MODEL` (mặc định `gemini-3.8-flash` theo danh mục model hiện hành; có thể đổi theo quyền truy cập tài khoản). Khi Gemini không cấu hình hoặc gọi lỗi, kết quả được đánh dấu là gợi ý theo quy tắc dự phòng. Hệ thống không chấp nhận cấu hình payment mẫu; khi thiếu cấu hình, API trả trạng thái chưa sẵn sàng. CORS và Socket.IO chỉ cho phép các origin khai báo ở `FRONTEND_URL`.

Thông tin liên hệ hiển thị ở cuối trang khách hàng lấy từ các biến tùy chọn `VITE_CLINIC_ADDRESS`, `VITE_CLINIC_PHONE`, `VITE_CLINIC_EMAIL` trong `Frontend/.env`. Chỉ các mục có giá trị mới được hiển thị; đặt lại các biến này trong môi trường triển khai và khởi động lại frontend để cập nhật.

SePay webhook dùng API key trong header `Authorization: Apikey …`, chỉ nhận giao dịch tiền vào, kiểm tra tài khoản nhận, mã lịch/hóa đơn, số tiền và ID giao dịch duy nhất. Hãy giả lập webhook trên DB riêng trước khi nối tài khoản ngân hàng thật.

Quick Tunnel Cloudflare chỉ dùng cho development; ai có URL đều có thể gọi backend đang được tunnel. Chỉ bật tunnel khi API đã được bảo vệ, giữ xác thực SePay, và dừng tiến trình tunnel khi xong. Tunnel tạm thời sẽ đổi URL sau lần chạy mới; cập nhật URL webhook trong SePay khi URL đổi. Không đưa URL tunnel vào `FRONTEND_URL` hoặc `VITE_API_BASE_URL`.

## API và quyền truy cập

Endpoint upload ảnh, hồ sơ bác sĩ, thanh toán và quyền truy cập được ghi tại [docs/API.md](docs/API.md).

- `PATIENT`: lịch, bệnh án và hóa đơn của chính mình; chỉ hủy lịch PENDING của mình.
- `DOCTOR`: lịch và nghiệp vụ bệnh nhân được phân công; không tự xác nhận hay đánh dấu hoàn tất lịch từ endpoint trạng thái.
- `ADMIN`: quản trị và xác nhận khoản thu tiền mặt.
- API được bảo vệ kiểm tra JWT và trạng thái tài khoản đang hoạt động ở mỗi request. Socket.IO yêu cầu JWT và chỉ phát sự kiện trong phòng tài khoản nhận.

## Kiểm tra và giới hạn

Các bước xác minh gần nhất và phần chưa chạy được ghi trong bàn giao của lần sửa. Chỉ chạy migration và webhook trên bản sao/database thử nghiệm trước; không cấu hình hoặc thử thanh toán thật trên tài khoản ngân hàng.

Một số quy trình vẫn cần hoàn thiện trước khi coi đây là hệ thống vận hành phòng khám: quan hệ dịch vụ–chuyên khoa để lọc bác sĩ theo dịch vụ, lịch làm việc phía admin, tái khám tạo lịch liên kết tự động, bộ lọc khoảng thời gian dashboard, luồng hoàn tiền và đối soát hoàn tiền, pagination cho các bảng lớn, xuất/in chứng từ trên nhiều trình duyệt và đồng bộ toàn bộ màn hình quản trị theo thiết kế thống nhất.

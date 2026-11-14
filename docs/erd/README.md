# MediClinic ERD

Các sơ đồ được dựng từ `Backend/database/schema.sql` và đối chiếu với toàn bộ migration `Backend/database/migrations/001`–`017`. Đây là tài liệu mô tả schema hiện có, không phải đề xuất đã áp dụng vào database. Không kết nối hoặc ghi dữ liệu vào database khi tạo các sơ đồ.

## Sơ đồ

| Miền dữ liệu | SVG có thể chỉnh sửa | PNG 300 DPI |
|---|---|---|
| Lịch làm và lịch hẹn | [ERD_01_Lich_lam_va_lich_hen.svg](ERD_01_Lich_lam_va_lich_hen.svg) | [ERD_01_Lich_lam_va_lich_hen.png](ERD_01_Lich_lam_va_lich_hen.png) |
| Hủy lịch và hoàn tiền | [ERD_02_Huy_lich_va_hoan_tien.svg](ERD_02_Huy_lich_va_hoan_tien.svg) | [ERD_02_Huy_lich_va_hoan_tien.png](ERD_02_Huy_lich_va_hoan_tien.png) |
| Bệnh án và kê đơn | [ERD_03_Kham_benh_va_ke_don.svg](ERD_03_Kham_benh_va_ke_don.svg) | [ERD_03_Kham_benh_va_ke_don.png](ERD_03_Kham_benh_va_ke_don.png) |
| Kho thuốc theo lô | [ERD_04_Kho_thuoc_theo_lo.svg](ERD_04_Kho_thuoc_theo_lo.svg) | [ERD_04_Kho_thuoc_theo_lo.png](ERD_04_Kho_thuoc_theo_lo.png) |

SVG là bản vector có thể mở/chỉnh bằng Inkscape, Illustrator hoặc phần mềm hỗ trợ SVG. PNG được xuất ở 300 DPI để chèn/in. Sơ đồ chia theo miền để tránh chữ quá nhỏ khi in.

## Chú giải

- `PK` là khóa chính; `FK` là khóa ngoại được khai báo trong schema.
- Đường liền biểu diễn FK thật. Đường đứt màu cam biểu diễn liên kết logic mà schema không khai báo FK.
- Nhãn `1:N`, `1:0..1` ghi bội số từ bảng cha tới bảng con. `UNIQUE` được ghi cạnh quan hệ khi schema có ràng buộc duy nhất.
- Một số cột tham chiếu chéo miền được ghi đích ngay trong tên cột trên sơ đồ; các bảng liên quan nằm ở sơ đồ khác.

## Bảng và cột hiện có được thể hiện

Các cột dưới đây là tên thật trong `schema.sql`; sơ đồ chỉ ghi các cột khóa và cột chính cần cho các luồng được yêu cầu, không chép toàn bộ mọi cột của từng bảng.

### Lịch làm và lịch hẹn

| Bảng hiện có | PK và FK/cột chính được thể hiện |
|---|---|
| `users` | PK `id`; `full_name`, `phone`, `role`, `is_active` |
| `specialties` | PK `id`; `name`, `is_active` |
| `rooms` | PK `id`; `room_number`, `name`, `location`, `is_active` |
| `doctors` | PK `id`; FK `user_id` (UNIQUE), `specialty_id`, `room_id`; `bio`, `experience_years`, `is_active` |
| `services` | PK `id`; FK `specialty_id`; `name`, `price`, `search_keywords`, `is_active` |
| `shifts` | PK `shift_id`; `name`, `start_time`, `end_time` |
| `shift_day_employee` | PK `id`; FK `doctor_id`; `work_date`; UNIQUE (`doctor_id`, `work_date`) |
| `shift_employee` | PK `id`; FK `shift_day_employee_id`, `shift_id`; `status`; UNIQUE (`shift_day_employee_id`, `shift_id`) |
| `shift_time_slots` | PK `id`; FK `shift_employee_id`; `start_time`, `end_time`, `status` |
| `appointments` | PK `appointment_id`; FK `patient_id`, `doctor_id`, `service_id`, `shift_employee_id`, `slot_id`; `appointment_date`, `time_slot`, `status`, `initial_symptoms`; UNIQUE `slot_id` |

**Quan hệ then chốt:** `appointments.slot_id` là FK tới `shift_time_slots.id`, không phải tới `shift_employee`. `appointments.shift_employee_id` là một FK riêng tới `shift_employee.id`. Hai cột cùng tồn tại. UNIQUE trên `appointments.slot_id` giới hạn tối đa một appointment cho mỗi slot không-NULL.

### Hủy lịch, hóa đơn và hoàn tiền

| Bảng hiện có | PK và FK/cột chính được thể hiện |
|---|---|
| `appointments` | PK `appointment_id`; FK `patient_id`; `status` |
| `users` | PK `id`; `full_name`, `role`, `phone` |
| `invoices` | PK `id`; FK `appointment_id` (UNIQUE), `patient_id`; `service_fee`, `medicine_fee`, `total_amount`, `payment_status`, `payment_method`, `paid_at` |
| `payments` | PK `payment_id`; FK `invoice_id`, `received_by`; `provider`, `external_transaction_id`, `payment_method`, `amount`, `payment_status`, `reconciliation_status`, `created_at` |
| `appointment_cancellation_requests` | PK `id`; FK `appointment_id`, `invoice_id`, `patient_id`, `processed_by`; `status`, `approved_refund_amount`, `refund_status`, `bank_details_encrypted` |
| `appointment_refunds` | PK `id`; FK `cancellation_request_id`, `payment_id`, `confirmed_by`; `amount`, `refund_method`, `status`, `confirmed_at`, `reference_code`, `created_at` |

Bảng thực tế tên **`appointment_refunds`**, không phải `refunds`. Người nhận refund được liên kết qua `appointment_cancellation_requests.patient_id → users.id`; không có `recipient_user_id` riêng trên refund. Thông tin ngân hàng nằm ở `bank_details_encrypted` trên yêu cầu hủy và phải tiếp tục được bảo vệ/mã hóa, không hiển thị công khai. Người duyệt yêu cầu là `processed_by`; người xác nhận hoàn là `confirmed_by`.

Ràng buộc UNIQUE hiện có trên `appointment_refunds(cancellation_request_id, payment_id)` cho phép một yêu cầu hoàn liên quan nhiều payments, nhưng không cho nhiều dòng hoàn cùng yêu cầu và cùng payment. Nếu nghiệp vụ cần nhiều đợt hoàn một payment thì cần xem xét thiết kế/ràng buộc riêng; chưa thay đổi schema.

### Bệnh án và kê đơn

| Bảng hiện có | PK và FK/cột chính được thể hiện |
|---|---|
| `appointment_records` | PK `record_id`; FK `appointment_id` (UNIQUE), `doctor_id`, `patient_id`, `icd10_code`; sinh hiệu, triệu chứng, chẩn đoán, kế hoạch/ghi chú |
| `prescriptions` | PK `prescription_id`; FK `record_id`, `drug_id`, `unit_id`, `meal_relation_id`; `dosage`, `frequency`, `duration`, `quantity`, `unit_price`, `billing_status`, `dispensing_status`, `dispensing_source`, `dispensed_at`, `dispensed_quantity`, `instructions` |
| `prescription_times` | PK `id`; FK `prescription_id`, `time_id` |
| `dosage_times` | PK `time_id`; `name` |
| `meal_relations` | PK `relation_id`; `name`, `is_active` |
| `drugs` | PK `drug_id`; FK `unit_id`; `name`, `price`, `stock_quantity` |
| `units` | PK `unit_id`; `name` |

Các FK chéo như `appointment_records.doctor_id → doctors.id`, `prescriptions.drug_id → drugs.drug_id` được ghi trên sơ đồ. Schema **không có** `prescriptions.dispensed_by`; vì vậy sơ đồ không thêm người xác nhận giao thuốc vào bảng này. Nếu cần audit người giao thuốc, đó là đề xuất schema riêng, chưa được áp dụng.

### Thuốc và tồn kho theo lô

| Bảng hiện có | PK và FK/cột chính được thể hiện |
|---|---|
| `drugs` | PK `drug_id`; FK `unit_id`; `name`, `price`, `stock_quantity`, `low_stock_threshold`, `is_active` |
| `drug_batches` | PK `batch_id`; FK `drug_id`, `created_by`; `batch_code`, `quantity_received`, `quantity_remaining`, `received_on`, `expires_on` |
| `stock_movements` | PK `id`; FK `batch_id` (nullable); `drug_id`, `quantity_delta`, `reason`, `reference_type`, `reference_id`, `performed_by`, `created_at` |
| `users` | PK `id`; `full_name`, `role`, `phone` |

Tên cột lô thống nhất theo schema là `batch_id`, `batch_code`, `received_on`, `expires_on`, `quantity_received`, `quantity_remaining`; không dùng các tên giả định `id`, `batch_number` hay `expiry_date`.

`drugs.stock_quantity` là cột lưu thường (không generated), nên DB không bắt buộc bằng tổng `drug_batches.quantity_remaining`. Ứng dụng có thể duy trì tổng thuốc bên cạnh tồn đã gắn lô/legacy stock; phải xem đây là tổng hợp được ứng dụng quản lý, không phải tồn độc lập tính tự động bởi database.

## FK thật và liên kết logic

- `stock_movements.batch_id → drug_batches.batch_id` là FK thật; `drug_batches.drug_id → drugs.drug_id` và `drug_batches.created_by → users.id` cũng là FK thật.
- `stock_movements.drug_id → drugs.drug_id` và `stock_movements.performed_by → users.id` là liên kết logic theo code/tên cột, nhưng **schema không khai báo FK**.
- `stock_movements.reference_type/reference_id` là tham chiếu đa hình (ví dụ code dùng `reference_type = 'PRESCRIPTION'`), không thể là FK đơn tới một bảng cụ thể.
- `invoice_items.item_reference_id` đi cùng `item_type` để chỉ dịch vụ/thuốc; schema không khai báo FK tới `services` hoặc `drugs`.
- Các đường liên kết được vẽ đứt trong sơ đồ kho là logic, không phải constraint database.

## Đã có và đề xuất cần cân nhắc

Tất cả các bảng nghiệp vụ cần đưa vào bốn sơ đồ đều **đã có** trong `schema.sql`; không cần tạo bảng lịch, slot, yêu cầu hủy, refund, lô thuốc hay movement trùng lặp chỉ để vẽ ERD.

Các điểm có thể cần migration trong tương lai nếu muốn tăng tính toàn vẹn/audit, nhưng **chưa tạo và chưa chạy**:

1. `prescriptions.dispensed_by` nếu cần lưu user đã xác nhận giao thuốc; hiện không có cột phù hợp.
2. Điều chỉnh UNIQUE refund nếu cần nhiều lần hoàn cho cùng một payment trong cùng một yêu cầu; cần xác định idempotency/nghiệp vụ trước để tránh ghi trùng.
3. Cân nhắc FK cho `stock_movements.drug_id` và `performed_by`; cần rà soát dữ liệu cũ trước vì FK mới có thể bị chặn bởi dòng mồ côi.
4. Không đề xuất thêm cột người nhận hoàn chỉ để sao chép bệnh nhân: người nhận hiện truy ra được qua `cancellation_request_id → patient_id`. Tài khoản nhận tiền theo từng lần hoàn là vấn đề nghiệp vụ riêng nếu muốn lưu khác với thông tin ở request.

## Đối chiếu schema và migrations

- Đã rà soát `Backend/database/migrations/001`–`017` và migration runner `Backend/database/migrate.js`.
- `001_email_verifications.sql` tạo bảng `email_verifications`, nhưng bảng này không có trong `schema.sql` tổng hợp.
- `migrate.js` tự tạo bảng `schema_migrations` để theo dõi migration; bảng này cũng không có trong `schema.sql`.
- Một số migration là chuỗi bổ sung: ví dụ trạng thái `NOT_DISPENSED` được thêm ở migration sau; trạng thái thông báo `INFO` cũng được migration sau bổ sung. Bản cuối trong `schema.sql` đã có các giá trị cuối cùng này.
- Các migration `009`, `010`, `016`, `017` chủ yếu thêm dữ liệu khởi tạo/danh mục/từ khóa, không phải tạo bảng nghiệp vụ mới.
- Ngoài hai bảng trên, sơ đồ schema cuối phản ánh các thay đổi cấu trúc chính của chuỗi migration đã rà soát. Việc đối chiếu này là giữa file, không phải so với database đang chạy.

## Phạm vi và an toàn

- Không chạy migration, không kết nối database và không thay đổi dữ liệu trong quá trình dựng sơ đồ.
- Tên bảng/cột/PK/FK trong hình phản ánh file schema/migrations, không khẳng định database runtime đã đồng bộ với các file đó.
- Không đưa thông tin bệnh nhân thật, mật khẩu, token hoặc thông tin tài khoản ngân hàng vào tài liệu.

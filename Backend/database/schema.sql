-- ========================================================
-- DATABASE SCHEMA NÂNG CẤP CHUẨN ĐỒ ÁN PTIT: MEDICLINIC
-- Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ========================================================

CREATE DATABASE IF NOT EXISTS `mediclinic_db`
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `mediclinic_db`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `prescription_times`;
DROP TABLE IF EXISTS `PrescriptionDetails`;
DROP TABLE IF EXISTS `follow_up_visits`;
DROP TABLE IF EXISTS `MedicalRecords`;
DROP TABLE IF EXISTS `Invoices`;
DROP TABLE IF EXISTS `Appointments`;
DROP TABLE IF EXISTS `shift_employee`;
DROP TABLE IF EXISTS `shifts`;
DROP TABLE IF EXISTS `meal_relations`;
DROP TABLE IF EXISTS `dosage_times`;
DROP TABLE IF EXISTS `units`;
DROP TABLE IF EXISTS `Medicines`;
DROP TABLE IF EXISTS `icd10_codes`;
DROP TABLE IF EXISTS `Services`;
DROP TABLE IF EXISTS `Doctors`;
DROP TABLE IF EXISTS `Rooms`;
DROP TABLE IF EXISTS `Specialties`;
DROP TABLE IF EXISTS `Users`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Bảng Users (Quản lý tài khoản hệ thống: Bệnh nhân, Bác sĩ, Admin)
CREATE TABLE `Users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL UNIQUE, -- Đăng nhập bằng Số điện thoại
    `email` VARCHAR(150) NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') DEFAULT 'OTHER',
    `date_of_birth` DATE NULL,
    `citizen_id` VARCHAR(50) NULL, -- CCCD / CMND
    `insurance_code` VARCHAR(50) NULL, -- Mã thẻ BHYT
    `emergency_contact` VARCHAR(50) NULL, -- SĐT khẩn cấp
    `job` VARCHAR(100) NULL, -- Nghề nghiệp
    `address` VARCHAR(255) NULL,
    `role` ENUM('PATIENT', 'DOCTOR', 'ADMIN') NOT NULL DEFAULT 'PATIENT',
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_phone` (`phone`),
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng Specialties (Chuyên khoa khám bệnh)
CREATE TABLE `Specialties` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng Rooms (Phòng khám cơ sở vật chất)
CREATE TABLE `Rooms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_number` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(150) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng Doctors (Bác sĩ & Chuyên môn)
CREATE TABLE `Doctors` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL UNIQUE,
    `specialty_id` INT NULL,
    `room_id` INT NULL,
    `bio` TEXT NULL,
    `experience_years` INT DEFAULT 0,
    `consultation_fee` DECIMAL(10, 2) DEFAULT 300000.00,
    CONSTRAINT `fk_doctors_user` FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_doctors_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `Specialties`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_doctors_room` FOREIGN KEY (`room_id`) REFERENCES `Rooms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng Services (Gói dịch vụ y tế)
CREATE TABLE `Services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `image_url` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng icd10_codes (Mã bệnh quốc tế ICD-10 chuẩn y khoa)
CREATE TABLE `icd10_codes` (
    `code` VARCHAR(50) PRIMARY KEY,
    `description` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng Units (Đơn vị tính thuốc: Viên, Vỉ, Hộp...)
CREATE TABLE `units` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bảng dosage_times (Thời điểm uống trong ngày: Sáng, Trưa, Chiều, Tối)
CREATE TABLE `dosage_times` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bảng meal_relations (Uống thuốc so với bữa ăn: Trước ăn, Sau ăn...)
CREATE TABLE `meal_relations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Bảng Medicines (Kho dược phẩm)
CREATE TABLE `Medicines` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `generic_name` VARCHAR(150) NULL, -- Tên hoạt chất
    `unit_id` INT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `stock_quantity` INT NOT NULL DEFAULT 0,
    `packing` VARCHAR(100) NULL, -- Quy cách đóng gói
    `side_effects` TEXT NULL, -- Tác dụng phụ
    `usage_guide` VARCHAR(255) NULL,
    CONSTRAINT `fk_medicines_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Bảng Appointments (Lịch khám bệnh & Đặt lịch)
CREATE TABLE `Appointments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `doctor_id` INT NOT NULL,
    `service_id` INT NULL,
    `appointment_date` DATE NOT NULL,
    `time_slot` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `initial_symptoms` TEXT NULL,
    `ai_predicted_specialty` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_appointments_patient` FOREIGN KEY (`patient_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_appointments_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `Doctors`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_appointments_service` FOREIGN KEY (`service_id`) REFERENCES `Services`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Bảng MedicalRecords (Bệnh án & 6 Chỉ số sinh hiệu)
CREATE TABLE `MedicalRecords` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NOT NULL UNIQUE,
    `doctor_id` INT NOT NULL,
    `patient_id` INT NOT NULL,
    `height` FLOAT NULL, -- Chiều cao (cm)
    `weight` FLOAT NULL, -- Cân nặng (kg)
    `blood_pressure` VARCHAR(50) NULL, -- Huyết áp (mmHg)
    `temperature` FLOAT NULL, -- Nhiệt độ (°C)
    `heart_rate` INT NULL, -- Nhịp tim (lần/phút)
    `spo2` FLOAT NULL, -- Nồng độ oxy SpO2 (%)
    `symptoms` TEXT NULL,
    `initial_diagnosis` TEXT NULL, -- Chẩn đoán ban đầu
    `final_diagnosis` TEXT NOT NULL, -- Chẩn đoán cuối cùng
    `icd10_code` VARCHAR(50) NULL,
    `treatment_plan` TEXT NULL,
    `advice` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_records_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_records_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `Doctors`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_records_patient` FOREIGN KEY (`patient_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_records_icd10` FOREIGN KEY (`icd10_code`) REFERENCES `icd10_codes`(`code`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Bảng PrescriptionDetails (Kê đơn thuốc)
CREATE TABLE `PrescriptionDetails` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `record_id` INT NOT NULL,
    `medicine_id` INT NOT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `dosage` VARCHAR(100) NOT NULL, -- Ví dụ: "1 Viên"
    `duration_days` INT DEFAULT 5, -- Số ngày uống
    `time_id` INT NULL, -- Sáng / Trưa / Chiều / Tối
    `meal_relation_id` INT NULL, -- Trước ăn / Sau ăn
    `usage_instruction` VARCHAR(255) NULL,
    CONSTRAINT `fk_prescription_record` FOREIGN KEY (`record_id`) REFERENCES `MedicalRecords`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_prescription_medicine` FOREIGN KEY (`medicine_id`) REFERENCES `Medicines`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_prescription_time` FOREIGN KEY (`time_id`) REFERENCES `dosage_times`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_prescription_meal` FOREIGN KEY (`meal_relation_id`) REFERENCES `meal_relations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Bảng follow_up_visits (Lịch hẹn tái khám)
CREATE TABLE `follow_up_visits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `record_id` INT NOT NULL UNIQUE,
    `follow_up_date` DATE NOT NULL,
    `notes` TEXT NULL,
    CONSTRAINT `fk_followup_record` FOREIGN KEY (`record_id`) REFERENCES `MedicalRecords`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Bảng Invoices (Hóa đơn viện phí & VNPAY)
CREATE TABLE `Invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NOT NULL UNIQUE,
    `patient_id` INT NOT NULL,
    `service_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `medicine_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `payment_status` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `payment_method` ENUM('CASH', 'VNPAY', 'MOMO', 'BANK_TRANSFER') DEFAULT 'VNPAY',
    `paid_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_invoices_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `Appointments`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_invoices_patient` FOREIGN KEY (`patient_id`) REFERENCES `Users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA)
-- Mật khẩu chung mã hóa bcrypt: 'password123'
-- ($2a$10$ePrTt0wlOZ.T9oGC7mN/W./OvzQK3XuI9D7wrDWjk4b0alT5SAtby)
-- ========================================================

-- 1. USERS: 3 TÀI KHOẢN CHÍNH KIỂM TRA ĐĂNG NHẬP
INSERT INTO `Users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `gender`, `role`, `address`) VALUES
-- TÀI KHOẢN ADMIN: SĐT: 0987654321 - MK: password123
(1, 'Quản Trị Viên (Admin)', '0987654321', 'admin@mediclinic.com', '$2a$10$ePrTt0wlOZ.T9oGC7mN/W./OvzQK3XuI9D7wrDWjk4b0alT5SAtby', 'MALE', 'ADMIN', 'Hà Nội'),

-- TÀI KHOẢN BÁC SĨ: SĐT: 0912345678 - MK: password123
(2, 'BS. CKII Nguyễn Văn An', '0912345678', 'doctor.an@mediclinic.com', '$2a$10$ePrTt0wlOZ.T9oGC7mN/W./OvzQK3XuI9D7wrDWjk4b0alT5SAtby', 'MALE', 'DOCTOR', 'TP. Hồ Chí Minh'),

-- TÀI KHOẢN BỆNH NHÂN: SĐT: 0912325678 - MK: password123
(3, 'Nguyễn Văn Nghĩa', '0912325678', 'nghia.nguyen@gmail.com', '$2a$10$ePrTt0wlOZ.T9oGC7mN/W./OvzQK3XuI9D7wrDWjk4b0alT5SAtby', 'MALE', 'PATIENT', '123 Nguyễn Trãi, Quận 1, TP.HCM');

-- 2. Chuyên khoa
INSERT INTO `Specialties` (`id`, `name`, `description`) VALUES
(1, 'Chuyên khoa nội', 'Khám nội khoa tổng quát, hô hấp, tiêu hóa, tuần hoàn'),
(2, 'Chuyên khoa ngoại', 'Khám và phẫu thuật chấn thương mô mềm, cơ xương khớp'),
(3, 'Khám Da liễu', 'Điều trị bệnh lý về da, viêm da dị ứng, thẩm mỹ y khoa'),
(4, 'Khám Răng - Hàm - Mặt', 'Nha khoa tổng quát, chỉnh nha, phục hình nụ cười');

-- 3. Phòng khám
INSERT INTO `Rooms` (`id`, `room_number`, `name`, `location`) VALUES
(1, 'P.101', 'Phòng Khám Nội Tổng Quát', 'Tầng 1 - Dãy A'),
(2, 'P.102', 'Phòng Khám Nhi', 'Tầng 1 - Dãy A'),
(3, 'P.201', 'Phòng Khám Da Liễu', 'Tầng 2 - Dãy B'),
(4, 'P.202', 'Phòng Răng Hàm Mặt', 'Tầng 2 - Dãy B');

-- 4. Bác sĩ
INSERT INTO `Doctors` (`id`, `user_id`, `specialty_id`, `room_id`, `bio`, `experience_years`, `consultation_fee`) VALUES
(1, 2, 1, 1, 'Bác sĩ chuyên khoa II giàu kinh nghiệm tại Bệnh viện Đại học Y Dược.', 15, 300000.00);

-- 5. Dịch vụ khám
INSERT INTO `Services` (`id`, `name`, `price`, `description`) VALUES
(1, 'Khám Nội tổng quát', 300000.00, 'Kiểm tra sức khỏe định kỳ, tư vấn điều trị toàn diện các bệnh lý nội khoa'),
(2, 'Khám Ngoại', 500000.00, 'Chẩn đoán và điều trị bệnh lý cơ xương khớp, chấn thương mô mềm'),
(3, 'Khám Da liễu', 250000.00, 'Chăm sóc và điều trị các bệnh lý về da liễu'),
(4, 'Khám Răng - Hàm - Mặt', 400000.00, 'Khám, tư vấn và điều trị răng miệng, thẩm mỹ nụ cười');

-- 6. Mã ICD-10
INSERT INTO `icd10_codes` (`code`, `description`) VALUES
('A00.0', 'Dịch tả do Vibrio cholerae 01, biovar cholerae'),
('A01.1', 'Paratyphoid fever A'),
('G43.0', 'Migraine không có triệu chứng báo trước'),
('I10', 'Tăng huyết áp vô căn (nguyên phát)'),
('L23', 'Viêm da tiếp xúc dị ứng'),
('J02.9', 'Viêm họng cấp không xác định');

-- 7. Đơn vị tính
INSERT INTO `units` (`id`, `name`, `description`) VALUES
(1, 'Viên', 'Dạng viên nén hoặc nang'),
(2, 'Vỉ', 'Vỉ thuốc'),
(3, 'Hộp', 'Hộp thuốc'),
(4, 'Chai', 'Chai dung dịch, siro');

-- 8. Thời điểm uống
INSERT INTO `dosage_times` (`id`, `name`, `description`) VALUES
(1, 'Sáng', 'Uống vào buổi sáng'),
(2, 'Trưa', 'Uống vào buổi trưa'),
(3, 'Chiều', 'Uống vào buổi chiều'),
(4, 'Tối', 'Uống vào buổi tối');

-- 9. Quan hệ bữa ăn
INSERT INTO `meal_relations` (`id`, `name`, `description`) VALUES
(1, 'Trước ăn', 'Uống trước bữa ăn 30 phút'),
(2, 'Sau ăn', 'Uống sau khi ăn no'),
(3, 'Trong lúc ăn', 'Uống trong bữa ăn');

-- 10. Thuốc
INSERT INTO `Medicines` (`id`, `name`, `generic_name`, `unit_id`, `price`, `stock_quantity`, `packing`) VALUES
(1, 'Paracetamol 500mg', 'Acetaminophen', 1, 2000.00, 1000, 'Hộp 10 vỉ x 10 viên'),
(2, 'Amoxicillin 500mg', 'Amoxicillin trihydrate', 1, 5000.00, 500, 'Hộp 1 vỉ x 10 viên'),
(3, 'Cetirizine 10mg', 'Cetirizine hydrochloride', 1, 3000.00, 300, 'Hộp 5 vỉ x 10 viên'),
(4, 'Vitamin B1 - B6 - B12', 'Multivitamin B', 1, 4000.00, 600, 'Hộp 5 vỉ x 10 viên');

-- ============================================================================
-- MEDICLINIC DATABASE SCHEMA (MONOLITHIC CONSOLIDATED FROM JAVA MICROSERVICES)
-- Target Database Engine: MySQL 8.0+ / MariaDB 10.5+
-- Charset: utf8mb4, Collation: utf8mb4_unicode_ci
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `mediclinic_db`
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `mediclinic_db`;


CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NOT NULL UNIQUE,
    `email` VARCHAR(150) NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') DEFAULT 'OTHER',
    `date_of_birth` DATE NULL,
    `citizen_id` VARCHAR(50) NULL,
    `insurance_code` VARCHAR(50) NULL,
    `emergency_contact` VARCHAR(50) NULL,
    `job` VARCHAR(100) NULL,
    `address` VARCHAR(255) NULL,
    `role` ENUM('PATIENT', 'DOCTOR', 'ADMIN') NOT NULL DEFAULT 'PATIENT',
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 2. BẢNG CHUYÊN KHOA (specialties) & PHÒNG KHÁM (rooms)
-- ----------------------------------------------------------------------------
CREATE TABLE `specialties` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL UNIQUE,
    `description` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT `chk_specialties_active` CHECK (`is_active` IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rooms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_number` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(150) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 3. BẢNG BÁC SĨ (doctors)
-- ----------------------------------------------------------------------------
CREATE TABLE `doctors` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL UNIQUE,
    `specialty_id` INT NULL,
    `room_id` INT NULL,
    `bio` TEXT NULL,
    `experience_years` INT DEFAULT 0,
    `consultation_fee` DECIMAL(10, 2) DEFAULT 300000.00,
    `avatar_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT `chk_doctors_experience` CHECK (`experience_years` >= 0),
    CONSTRAINT `chk_doctors_fee` CHECK (`consultation_fee` >= 0),
    CONSTRAINT `fk_doctors_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_doctors_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_doctors_room` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. BẢNG GÓI DỊCH VỤ Y TẾ (services)
-- ----------------------------------------------------------------------------
CREATE TABLE `services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `description` TEXT NULL,
    `image_url` VARCHAR(255) NULL,
    `specialty_id` INT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX `idx_services_specialty` (`specialty_id`),
    CONSTRAINT `fk_services_specialty` FOREIGN KEY (`specialty_id`) REFERENCES `specialties`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_services_price` CHECK (`price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. BẢNG QUẢN LÝ LỊCH LÀM VIỆC / CA TRỰC BÁC SĨ (shifts & schedule)
-- ----------------------------------------------------------------------------
CREATE TABLE `shifts` (
    `shift_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE, -- 'Sáng', 'Chiều', 'Tối'
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shift_day_employee` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `doctor_id` INT NOT NULL,
    `work_date` DATE NOT NULL,
    CONSTRAINT `fk_shift_day_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_doctor_date` (`doctor_id`, `work_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shift_employee` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shift_day_employee_id` INT NOT NULL,
    `shift_id` INT NOT NULL,
    `status` ENUM('AVAILABLE', 'FULL', 'OFF') DEFAULT 'AVAILABLE',
    UNIQUE KEY `uq_shift_day_shift` (`shift_day_employee_id`, `shift_id`),
    CONSTRAINT `fk_shift_emp_day` FOREIGN KEY (`shift_day_employee_id`) REFERENCES `shift_day_employee`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_shift_emp_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`shift_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `shift_time_slots` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shift_employee_id` INT NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    -- BOOKED marks a reserved slot; AVAILABLE is bookable, OFF is closed.
    `status` ENUM('AVAILABLE', 'BOOKED', 'OFF') NOT NULL DEFAULT 'AVAILABLE',
    UNIQUE KEY `uq_shift_employee_start` (`shift_employee_id`, `start_time`),
    INDEX `idx_shift_slots_status` (`shift_employee_id`, `status`, `start_time`),
    CONSTRAINT `fk_shift_time_slots_employee` FOREIGN KEY (`shift_employee_id`) REFERENCES `shift_employee`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. BẢNG THANH TOÁN (payments)
-- ----------------------------------------------------------------------------
CREATE TABLE `payments` (
    `payment_id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NULL,
    `provider` VARCHAR(32) NOT NULL DEFAULT 'INTERNAL',
    `external_transaction_id` VARCHAR(150) NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER') DEFAULT 'CASH',
    `transaction_code` VARCHAR(100) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_status` ENUM('UNPAID', 'PAID', 'FAILED') DEFAULT 'UNPAID',
    `reconciliation_status` ENUM('MATCHED', 'PARTIAL', 'OVERPAID', 'REVIEW') NOT NULL DEFAULT 'MATCHED',
    `received_by` INT NULL,
    `expires_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_payments_provider_external_txn` (`provider`, `external_transaction_id`),
    INDEX `idx_payments_invoice_status` (`invoice_id`, `payment_status`),
    CONSTRAINT `chk_payments_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. BẢNG LỊCH HẸN KHÁM (appointments)
-- ----------------------------------------------------------------------------
CREATE TABLE `appointments` (
    `appointment_id` INT AUTO_INCREMENT PRIMARY KEY,
    `patient_id` INT NOT NULL,
    `doctor_id` INT NOT NULL,
    `service_id` INT NULL,
    `shift_employee_id` INT NULL,
    `slot_id` INT NULL,
    `appointment_date` DATE NOT NULL,
    `time_slot` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `initial_symptoms` TEXT NULL,
    `ai_predicted_specialty` VARCHAR(100) NULL,
    `full_name` VARCHAR(150) NULL,
    `phone_number` VARCHAR(20) NULL,
    `dob` DATE NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `address` VARCHAR(255) NULL,
    `insurance_code` VARCHAR(50) NULL,
    `citizen_id` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_appointments_doctor_slot` (`doctor_id`, `appointment_date`, `time_slot`, `status`),
    INDEX `idx_appointments_patient_date` (`patient_id`, `appointment_date`, `status`),
    UNIQUE KEY `uq_appointments_slot_id` (`slot_id`),
    CONSTRAINT `fk_app_patient` FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_app_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_app_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_app_shift_slot` FOREIGN KEY (`shift_employee_id`) REFERENCES `shift_employee`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_appointments_time_slot` FOREIGN KEY (`slot_id`) REFERENCES `shift_time_slots`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. DANH MỤC DƯỢC PHẨM & MÃ BỆNH (icd10_codes, units, dosage_times, meal_relations, drugs)
-- ----------------------------------------------------------------------------
CREATE TABLE `icd10_codes` (
    `code` VARCHAR(50) PRIMARY KEY,
    `description` TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `units` (
    `unit_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `dosage_times` (
    `time_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE, -- 'Sáng', 'Trưa', 'Chiều', 'Tối'
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `meal_relations` (
    `relation_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE, -- 'Trước ăn', 'Sau ăn', 'Trong khi ăn'
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Minimal WHO ICD-10 starter catalog; not a full clinical coding dataset.
INSERT INTO `icd10_codes` (`code`, `description`) VALUES
    ('I10', 'Essential (primary) hypertension'),
    ('L23', 'Allergic contact dermatitis');

INSERT INTO `meal_relations` (`name`, `description`) VALUES
    ('Trước ăn', 'Theo hướng dẫn trước bữa ăn'),
    ('Sau ăn', 'Theo hướng dẫn sau bữa ăn'),
    ('Trong khi ăn', 'Dùng cùng bữa ăn'),
    ('Không phụ thuộc bữa ăn', 'Không yêu cầu thời điểm dùng thuốc theo bữa ăn');

CREATE TABLE `drugs` (
    `drug_id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `generic_name` VARCHAR(150) NULL,
    `unit_id` INT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `stock_quantity` INT NOT NULL DEFAULT 0,
    `low_stock_threshold` INT UNSIGNED NOT NULL DEFAULT 10,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `packing` VARCHAR(100) NULL,
    `side_effects` TEXT NULL,
    `contraindications` TEXT NULL,
    CONSTRAINT `fk_drugs_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`unit_id`) ON DELETE SET NULL,
    CONSTRAINT `chk_drugs_price` CHECK (`price` >= 0),
    CONSTRAINT `chk_drugs_stock` CHECK (`stock_quantity` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. HỒ SƠ BỆNH ÁN & CÁC CHỈ SỐ LÂM SÀNG (appointment_records)
-- ----------------------------------------------------------------------------
CREATE TABLE `appointment_records` (
    `record_id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NOT NULL UNIQUE,
    `doctor_id` INT NOT NULL,
    `patient_id` INT NOT NULL,
    `height` FLOAT NULL, -- Chiều cao (cm)
    `weight` FLOAT NULL, -- Cân nặng (kg)
    `blood_pressure` VARCHAR(50) NULL, -- Huyết áp (mmHg)
    `temperature` FLOAT NULL, -- Nhiệt độ (°C)
    `heart_rate` FLOAT NULL, -- Nhịp tim (lần/phút)
    `spo2` FLOAT NULL, -- SpO2 (%)
    `symptoms` TEXT NULL,
    `initial_diagnosis` TEXT NULL,
    `final_diagnosis` TEXT NOT NULL,
    `icd10_code` VARCHAR(50) NULL,
    `treatment_plan` TEXT NULL,
    `notes` TEXT NULL,
    `advice` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_rec_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_rec_doctor` FOREIGN KEY (`doctor_id`) REFERENCES `doctors`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_rec_patient` FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_rec_icd10` FOREIGN KEY (`icd10_code`) REFERENCES `icd10_codes`(`code`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. KÊ ĐƠN THUỐC (prescriptions & prescription_times)
-- ----------------------------------------------------------------------------
CREATE TABLE `prescriptions` (
    `prescription_id` INT AUTO_INCREMENT PRIMARY KEY,
    `record_id` INT NOT NULL,
    `drug_id` INT NOT NULL,
    `custom_drug_name` VARCHAR(150) NULL,
    `dosage` VARCHAR(100) NOT NULL, -- '1 Viên'
    `frequency` VARCHAR(100) NULL, -- '2 lần / ngày'
    `duration` INT DEFAULT 5, -- Số ngày uống
    `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0,
    `billing_status` ENUM('UNBILLED','BILLED') NOT NULL DEFAULT 'UNBILLED',
    `dispensing_status` ENUM('PRESCRIBED','DISPENSED','NOT_DISPENSED') NOT NULL DEFAULT 'PRESCRIBED',
    `dispensed_at` DATETIME NULL,
    `dispensed_quantity` INT UNSIGNED NOT NULL DEFAULT 0,
    `dispensed_unit_price` DECIMAL(12,2) NULL,
    `dispensing_source` ENUM('CLINIC','EXTERNAL') NULL DEFAULT NULL,
    `unit_id` INT NULL,
    `meal_relation_id` INT NULL,
    `instructions` TEXT NULL,
    CONSTRAINT `fk_pres_record` FOREIGN KEY (`record_id`) REFERENCES `appointment_records`(`record_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_pres_drug` FOREIGN KEY (`drug_id`) REFERENCES `drugs`(`drug_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_pres_unit` FOREIGN KEY (`unit_id`) REFERENCES `units`(`unit_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pres_meal` FOREIGN KEY (`meal_relation_id`) REFERENCES `meal_relations`(`relation_id`) ON DELETE SET NULL,
    CONSTRAINT `chk_pres_quantity` CHECK (`quantity` > 0),
    CONSTRAINT `chk_pres_duration` CHECK (`duration` > 0),
    CONSTRAINT `chk_pres_unit_price` CHECK (`unit_price` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prescription_times` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `prescription_id` INT NOT NULL,
    `time_id` INT NOT NULL,
    CONSTRAINT `fk_prestime_pres` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions`(`prescription_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_prestime_time` FOREIGN KEY (`time_id`) REFERENCES `dosage_times`(`time_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. BẢNG TÁI KHÁM (follow_up_visits)
-- ----------------------------------------------------------------------------
CREATE TABLE `follow_up_visits` (
    `follow_up_id` INT AUTO_INCREMENT PRIMARY KEY,
    `record_id` INT NOT NULL UNIQUE,
    `follow_up_date` DATE NOT NULL,
    `instruction` TEXT NULL,
    CONSTRAINT `fk_followup_record` FOREIGN KEY (`record_id`) REFERENCES `appointment_records`(`record_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. BẢNG HÓA ĐƠN VIỆN PHÍ (invoices)
-- ----------------------------------------------------------------------------
CREATE TABLE `invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NOT NULL UNIQUE,
    `patient_id` INT NOT NULL,
    `service_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `medicine_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `payment_status` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `payment_method` ENUM('CASH', 'BANK_TRANSFER') DEFAULT 'CASH',
    `cash_requested_at` DATETIME NULL,
    `paid_at` DATETIME NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_invoices_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_invoices_patient` FOREIGN KEY (`patient_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_invoice_total` CHECK (`service_fee` >= 0 AND `medicine_fee` >= 0 AND `total_amount` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `payments`
    ADD CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT;

ALTER TABLE `payments`
    ADD CONSTRAINT `fk_payments_received_by` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;

CREATE TABLE `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `recipient_user_id` INT NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `message` TEXT NOT NULL,
    `invoice_id` INT NULL,
    `appointment_id` INT NULL,
    `dedupe_key` VARCHAR(190) NOT NULL,
    `status` ENUM('ACTION_REQUIRED','PAID','REVIEW','SUPERSEDED','INFO') NOT NULL DEFAULT 'ACTION_REQUIRED',
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_notifications_dedupe` (`dedupe_key`),
    INDEX `idx_notifications_recipient` (`recipient_user_id`, `is_read`, `created_at`),
    CONSTRAINT `fk_notifications_recipient` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_notifications_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_notifications_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`appointment_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `invoice_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NOT NULL,
    `item_type` ENUM('SERVICE','MEDICINE','OTHER') NOT NULL,
    `item_reference_id` INT NULL,
    `description` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(10,2) NOT NULL,
    `unit_price` DECIMAL(12,2) NOT NULL,
    `line_total` DECIMAL(12,2) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_invoice_items_invoice` (`invoice_id`),
    CONSTRAINT `fk_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `chk_invoice_items_quantity` CHECK (`quantity` > 0),
    CONSTRAINT `chk_invoice_items_unit_price` CHECK (`unit_price` >= 0),
    CONSTRAINT `chk_invoice_items_line_total` CHECK (`line_total` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_movements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `drug_id` INT NOT NULL,
    `batch_id` BIGINT UNSIGNED NULL,
    `quantity_delta` INT NOT NULL,
    `reason` VARCHAR(100) NOT NULL,
    `note` VARCHAR(255) NULL,
    `reference_type` VARCHAR(40) NULL,
    `reference_id` BIGINT NULL,
    `performed_by` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_stock_movements_drug_time` (`drug_id`, `created_at`),
    INDEX `idx_stock_movements_reference` (`reference_type`, `reference_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `drug_batches` (
    `batch_id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `drug_id` INT NOT NULL,
    `batch_code` VARCHAR(100) NULL,
    `quantity_received` INT UNSIGNED NOT NULL,
    `quantity_remaining` INT UNSIGNED NOT NULL,
    `received_on` DATE NOT NULL,
    `expires_on` DATE NOT NULL,
    `created_by` INT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_drug_batches_drug_expiry` (`drug_id`, `expires_on`, `quantity_remaining`),
    CONSTRAINT `fk_drug_batches_drug` FOREIGN KEY (`drug_id`) REFERENCES `drugs`(`drug_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_drug_batches_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    CONSTRAINT `chk_drug_batches_received` CHECK (`quantity_received` > 0),
    CONSTRAINT `chk_drug_batches_remaining` CHECK (`quantity_remaining` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `stock_movements`
    ADD CONSTRAINT `fk_stock_movements_batch` FOREIGN KEY (`batch_id`) REFERENCES `drug_batches`(`batch_id`) ON DELETE RESTRICT;

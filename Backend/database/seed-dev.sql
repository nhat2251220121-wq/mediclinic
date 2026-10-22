-- DEVELOPMENT ONLY. Never run this file against a database containing clinic data.
USE `mediclinic_db`;

INSERT INTO specialties (name, description) VALUES
('Nội tổng quát', 'Khám và tư vấn nội khoa tổng quát'),
('Da liễu', 'Khám các bệnh lý da liễu')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO services (name, price, description, specialty_id)
SELECT 'Khám nội tổng quát', 300000, 'Khám và tư vấn nội khoa tổng quát',
       (SELECT id FROM specialties WHERE name = 'Nội tổng quát' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Khám nội tổng quát');
INSERT INTO services (name, price, description, specialty_id)
SELECT 'Khám da liễu', 250000, 'Khám và tư vấn các bệnh lý da liễu',
       (SELECT id FROM specialties WHERE name = 'Da liễu' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Khám da liễu');

-- The seed is also safe to rerun after the service_specialty migration.
UPDATE services s JOIN specialties sp ON sp.name = 'Nội tổng quát'
SET s.specialty_id = sp.id WHERE s.name = 'Khám nội tổng quát' AND s.specialty_id IS NULL;
UPDATE services s JOIN specialties sp ON sp.name = 'Da liễu'
SET s.specialty_id = sp.id WHERE s.name = 'Khám da liễu' AND s.specialty_id IS NULL;

INSERT IGNORE INTO shifts (name, start_time, end_time) VALUES
('Ca sáng', '07:30:00', '12:00:00'),
('Ca chiều', '13:30:00', '17:00:00');

INSERT INTO units (name, description) VALUES
('Viên', 'Đơn vị viên thuốc'),
('Chai', 'Đơn vị chai thuốc')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO dosage_times (name, description) VALUES
('Sáng', 'Uống buổi sáng'), ('Trưa', 'Uống buổi trưa'), ('Chiều', 'Uống buổi chiều'), ('Tối', 'Uống buổi tối')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO meal_relations (name, description) VALUES
('Trước ăn', 'Theo hướng dẫn trước bữa ăn'), ('Sau ăn', 'Theo hướng dẫn sau bữa ăn'), ('Trong khi ăn', 'Dùng cùng bữa ăn')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO icd10_codes (code, description) VALUES
('J02.9', 'Viêm họng cấp, không xác định'), ('I10', 'Tăng huyết áp vô căn'), ('L23', 'Viêm da tiếp xúc dị ứng')
ON DUPLICATE KEY UPDATE description = VALUES(description);

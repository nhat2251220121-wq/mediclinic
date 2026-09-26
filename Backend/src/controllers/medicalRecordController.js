const { pool } = require('../config/db');

/**
 * Bác sĩ lưu kết quả khám lâm sàng, sinh hiệu, chẩn đoán ICD-10, kê đơn thuốc và tái khám
 */
const createMedicalRecord = async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const {
            appointment_id,
            height,
            weight,
            blood_pressure,
            temperature,
            heart_rate,
            spo2,
            symptoms,
            initial_diagnosis,
            final_diagnosis,
            icd10_code,
            treatment_plan,
            advice,
            follow_up_date,
            follow_up_notes,
            prescriptions = [] // [{ medicine_id, quantity, dosage, duration_days, time_id, meal_relation_id, usage_instruction }]
        } = req.body;

        const [appRows] = await connection.query(
            'SELECT id, patient_id, doctor_id, status FROM Appointments WHERE id = ?',
            [appointment_id]
        );

        if (appRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy lịch hẹn tương ứng.'
            });
        }

        const appointment = appRows[0];

        // 1. Tạo MedicalRecords với đầy đủ 6 chỉ số sinh hiệu và ICD-10
        const [recordResult] = await connection.query(
            `INSERT INTO MedicalRecords (
                appointment_id, doctor_id, patient_id, 
                height, weight, blood_pressure, temperature, heart_rate, spo2,
                symptoms, initial_diagnosis, final_diagnosis, icd10_code, treatment_plan, advice
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                appointment.id, appointment.doctor_id, appointment.patient_id,
                height || null, weight || null, blood_pressure || null, temperature || null, heart_rate || null, spo2 || null,
                symptoms || null, initial_diagnosis || null, final_diagnosis, icd10_code || null, treatment_plan || null, advice || null
            ]
        );
        const recordId = recordResult.insertId;

        // 2. Lưu tái khám nếu có
        if (follow_up_date) {
            await connection.query(
                `INSERT INTO follow_up_visits (record_id, follow_up_date, notes) VALUES (?, ?, ?)`,
                [recordId, follow_up_date, follow_up_notes || null]
            );
        }

        // 3. Lưu chi tiết đơn thuốc
        let medicineTotalFee = 0;
        for (const item of prescriptions) {
            await connection.query(
                `INSERT INTO PrescriptionDetails (
                    record_id, medicine_id, quantity, dosage, duration_days, time_id, meal_relation_id, usage_instruction
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    recordId, item.medicine_id, item.quantity || 1, item.dosage || '1 Viên',
                    item.duration_days || 5, item.time_id || null, item.meal_relation_id || null, item.usage_instruction || null
                ]
            );

            // Tính tiền thuốc
            const [medRows] = await connection.query('SELECT price FROM Medicines WHERE id = ?', [item.medicine_id]);
            if (medRows.length > 0) {
                medicineTotalFee += parseFloat(medRows[0].price) * (item.quantity || 1);
            }
        }

        // 4. Lấy phí khám và tạo hóa đơn
        const [docRows] = await connection.query('SELECT consultation_fee FROM Doctors WHERE id = ?', [appointment.doctor_id]);
        const serviceFee = docRows.length > 0 ? parseFloat(docRows[0].consultation_fee) : 300000;
        const totalAmount = serviceFee + medicineTotalFee;

        await connection.query(
            `INSERT INTO Invoices (appointment_id, patient_id, service_fee, medicine_fee, total_amount, payment_status, payment_method)
             VALUES (?, ?, ?, ?, ?, 'UNPAID', 'VNPAY')`,
            [appointment.id, appointment.patient_id, serviceFee, medicineTotalFee, totalAmount]
        );

        // 5. Cập nhật lịch hẹn COMPLETED
        await connection.query('UPDATE Appointments SET status = "COMPLETED" WHERE id = ?', [appointment.id]);

        await connection.commit();

        res.status(201).json({
            success: true,
            message: 'Đã lưu bệnh án, kết quả sinh hiệu và kê đơn thuốc thành công!',
            data: {
                record_id: recordId,
                total_amount: totalAmount
            }
        });
    } catch (error) {
        await connection.rollback();
        next(error);
    } finally {
        connection.release();
    }
};

/**
 * Lấy danh sách hồ sơ bệnh án
 */
const getPatientRecords = async (req, res, next) => {
    try {
        const { role, id: userId } = req.user;
        let query = `
            SELECT 
                mr.*,
                a.appointment_date, a.time_slot,
                p.full_name as patient_name, p.phone as patient_phone,
                du.full_name as doctor_name, s.name as specialty_name,
                fv.follow_up_date, fv.notes as follow_up_notes
            FROM MedicalRecords mr
            JOIN Appointments a ON mr.appointment_id = a.id
            JOIN Users p ON mr.patient_id = p.id
            JOIN Doctors d ON mr.doctor_id = d.id
            JOIN Users du ON d.user_id = du.id
            LEFT JOIN Specialties s ON d.specialty_id = s.id
            LEFT JOIN follow_up_visits fv ON mr.id = fv.record_id
        `;
        const params = [];

        if (role === 'PATIENT') {
            query += ' WHERE mr.patient_id = ? ORDER BY mr.created_at DESC';
            params.push(userId);
        } else if (role === 'DOCTOR') {
            query += ' WHERE d.user_id = ? ORDER BY mr.created_at DESC';
            params.push(userId);
        } else {
            query += ' ORDER BY mr.created_at DESC';
        }

        const [records] = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: records
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Xem chi tiết bệnh án kèm sinh hiệu và đơn thuốc
 */
const getRecordDetail = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [records] = await pool.query(
            `SELECT 
                mr.*, p.full_name as patient_name, p.phone as patient_phone, p.date_of_birth, p.gender,
                du.full_name as doctor_name, a.appointment_date, a.time_slot,
                fv.follow_up_date, fv.notes as follow_up_notes
             FROM MedicalRecords mr
             JOIN Users p ON mr.patient_id = p.id
             JOIN Doctors d ON mr.doctor_id = d.id
             JOIN Users du ON d.user_id = du.id
             JOIN Appointments a ON mr.appointment_id = a.id
             LEFT JOIN follow_up_visits fv ON mr.id = fv.record_id
             WHERE mr.id = ?`,
            [id]
        );

        if (records.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy hồ sơ bệnh án.'
            });
        }

        const [medicines] = await pool.query(
            `SELECT 
                pd.*, m.name as medicine_name, u.name as unit_name,
                dt.name as time_name, mr_eat.name as meal_name
             FROM PrescriptionDetails pd
             JOIN Medicines m ON pd.medicine_id = m.id
             LEFT JOIN units u ON m.unit_id = u.id
             LEFT JOIN dosage_times dt ON pd.time_id = dt.id
             LEFT JOIN meal_relations mr_eat ON pd.meal_relation_id = mr_eat.id
             WHERE pd.record_id = ?`,
            [id]
        );

        res.status(200).json({
            success: true,
            data: {
                ...records[0],
                prescriptions: medicines
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createMedicalRecord,
    getPatientRecords,
    getRecordDetail
};

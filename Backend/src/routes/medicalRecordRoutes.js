const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecordController');
const verifyToken = require('../middlewares/verifyToken');
const { isDoctor } = require('../middlewares/checkRole');

router.use(verifyToken);

// Bác sĩ lưu hồ sơ bệnh án và đơn thuốc
router.post('/', isDoctor, medicalRecordController.createMedicalRecord);

// Lấy danh sách hồ sơ bệnh án (phân theo role)
router.get('/', medicalRecordController.getPatientRecords);

// Xem chi tiết một hồ sơ bệnh án kèm đơn thuốc
router.get('/:id', medicalRecordController.getRecordDetail);

module.exports = router;

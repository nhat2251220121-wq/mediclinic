const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

// Lấy danh sách chuyên khoa
router.get('/specialties', doctorController.getSpecialties);

// Lấy danh sách bác sĩ (Có thể lọc theo ?specialty_id=...)
router.get('/', doctorController.getDoctors);

// Lấy thông tin chi tiết một bác sĩ
router.get('/:id', doctorController.getDoctorById);

module.exports = router;

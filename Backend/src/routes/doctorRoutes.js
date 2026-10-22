const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const verifyToken = require('../middlewares/verifyToken');
const { isDoctor } = require('../middlewares/checkRole');
const uploadImage = require('../middlewares/imageUpload');

// Lấy danh sách chuyên khoa
router.get('/specialties', doctorController.getSpecialties);
router.get('/services', doctorController.getServices);
router.get('/availability/slots', doctorController.getAvailableSlots);
router.get('/availability/shifts', doctorController.getShifts);
router.get('/me/profile', verifyToken, isDoctor, doctorController.getMyProfile);
router.patch('/me/profile', verifyToken, isDoctor, doctorController.updateMyProfile);
router.post('/me/avatar', verifyToken, isDoctor, uploadImage, doctorController.uploadMyAvatar);
router.delete('/me/avatar', verifyToken, isDoctor, doctorController.removeMyAvatar);
router.get('/me/schedule', verifyToken, isDoctor, doctorController.getMySchedule);
router.put('/me/schedule', verifyToken, isDoctor, doctorController.saveMySchedule);

// Lấy danh sách bác sĩ (Có thể lọc theo ?specialty_id=...)
router.get('/', doctorController.getDoctors);

// Lấy thông tin chi tiết một bác sĩ
router.get('/:id', doctorController.getDoctorById);

module.exports = router;

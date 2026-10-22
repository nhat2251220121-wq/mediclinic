const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminMgmtController');
const verifyToken = require('../middlewares/verifyToken');
const { isAdmin } = require('../middlewares/checkRole');
const uploadImage = require('../middlewares/imageUpload');

// Áp dụng bảo vệ token và kiểm tra quyền Admin
router.use(verifyToken);
router.use(isAdmin);

// 1. Thống kê Dashboard
router.get('/dashboard-stats', adminController.getDashboardStats);

// 2. Quản lý Thuốc
router.get('/medicines', adminController.getMedicines);
router.post('/medicines', adminController.createMedicine);
router.put('/medicines/:id', adminController.updateMedicine);
router.delete('/medicines/:id', adminController.deleteMedicine);

// 3. Quản lý Chuyên Khoa
router.get('/specialties', adminController.getSpecialties);
router.post('/specialties', adminController.createSpecialty);
router.put('/specialties/:id', adminController.updateSpecialty);
router.delete('/specialties/:id', adminController.deleteSpecialty);

// 4. Quản lý Phòng Khám
router.get('/rooms', adminController.getRooms);
router.post('/rooms', adminController.createRoom);
router.put('/rooms/:id', adminController.updateRoom);
router.delete('/rooms/:id', adminController.deleteRoom);

// 5. Quản lý Dịch Vụ
router.get('/services', adminController.getServices);
router.post('/services', adminController.createService);
router.put('/services/:id', adminController.updateService);
router.delete('/services/:id', adminController.deleteService);
router.post('/services/:id/image', uploadImage, adminController.uploadServiceImage);
router.delete('/services/:id/image', adminController.removeServiceImage);

router.get('/doctors', adminController.getDoctors);
router.post('/doctors', adminController.createDoctor);
router.put('/doctors/:id', adminController.updateDoctor);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.post('/doctors/:id/avatar', uploadImage, adminController.uploadDoctorAvatar);
router.delete('/doctors/:id/avatar', adminController.removeDoctorAvatar);

// 6. Quản lý Bệnh Nhân
router.get('/patients', adminController.getPatients);
router.put('/patients/:id', adminController.updatePatient);

module.exports = router;

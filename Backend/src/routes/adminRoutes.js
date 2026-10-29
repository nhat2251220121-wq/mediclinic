const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminMgmtController');
const verifyToken = require('../middlewares/verifyToken');
const { isAdmin } = require('../middlewares/checkRole');
const uploadImage = require('../middlewares/imageUpload');
const adminScheduleController = require('../controllers/adminScheduleController');

// Áp dụng bảo vệ token và kiểm tra quyền Admin
router.use(verifyToken);
router.use(isAdmin);

// 1. Thống kê Dashboard
router.get('/dashboard-stats', adminController.getDashboardStats);

// 2. Quản lý Thuốc
router.get('/medicines', adminController.getMedicines);
router.get('/medicine-units', adminController.getMedicineUnits);
router.post('/medicines', adminController.createMedicine);
router.put('/medicines/:id', adminController.updateMedicine);
router.delete('/medicines/:id', adminController.deleteMedicine);
router.get('/medicines/:id/lots', adminController.getMedicineLots);
router.post('/medicines/:id/lots', adminController.receiveMedicineBatch);
router.post('/medicines/:id/lots/classify', adminController.classifyLegacyMedicineStock);
router.post('/medicine-lots/:batchId/adjust', adminController.changeMedicineBatchStock);
router.post('/medicine-lots/:batchId/write-off', adminController.writeOffMedicineBatch);
router.get('/work-schedule/slots', adminScheduleController.getWorkSlots);
router.patch('/work-schedule/slots/:slotId/status', adminScheduleController.setWorkSlotStatus);
router.get('/meal-relations', adminController.getMealRelations);
router.post('/meal-relations', adminController.createMealRelation);
router.put('/meal-relations/:id', adminController.updateMealRelation);
router.delete('/meal-relations/:id', adminController.deactivateMealRelation);

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
router.get('/patients/:id/details', adminController.getPatientDetails);
router.get('/patients/:patientId/medical-records/:recordId', adminController.getPatientMedicalRecordDetail);
router.put('/patients/:id', adminController.updatePatient);

module.exports = router;

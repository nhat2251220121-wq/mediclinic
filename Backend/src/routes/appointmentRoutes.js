const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const verifyToken = require('../middlewares/verifyToken');
const { isPatient, checkRole } = require('../middlewares/checkRole');

// Tất cả các route lịch hẹn đều yêu cầu đăng nhập
router.use(verifyToken);

// Bệnh nhân đặt lịch khám
router.post('/', isPatient, appointmentController.createAppointment);

// Lấy danh sách lịch hẹn (Patient xem của mình, Doctor xem danh sách khám, Admin xem toàn bộ)
router.get('/', appointmentController.getAppointments);

// Cập nhật trạng thái lịch hẹn (Bác sĩ, Admin hoặc Bệnh nhân tự hủy)
router.patch('/:id/status', checkRole('ADMIN', 'DOCTOR', 'PATIENT'), appointmentController.updateAppointmentStatus);

module.exports = router;

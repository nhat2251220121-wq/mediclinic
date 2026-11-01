const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const verifyToken = require('../middlewares/verifyToken');
const { isPatient, isAdmin } = require('../middlewares/checkRole');
const cancellationController = require('../controllers/cancellationController');

// Tất cả các route lịch hẹn đều yêu cầu đăng nhập
router.use(verifyToken);

// Bệnh nhân đặt lịch khám
router.post('/', isPatient, appointmentController.createAppointment);

// Patient cancellation is a separate workflow; it never bypasses the approval/refund rules.
router.post('/:id/cancellation-requests', isPatient, cancellationController.createPatientRequest);
router.get('/cancellation-requests/mine', isPatient, cancellationController.listMine);
router.put('/cancellation-requests/:requestId/bank-details', isPatient, cancellationController.updateMineBankDetails);

// Admin-only cancellation, refund and no-show operations.
router.get('/admin/cancellation-requests', isAdmin, cancellationController.listAdmin);
router.post('/admin/cancellation-requests/:requestId/approve', isAdmin, cancellationController.approve);
router.post('/admin/cancellation-requests/:requestId/reject', isAdmin, cancellationController.reject);
router.post('/admin/cancellation-requests/:requestId/refunds/:refundId/complete', isAdmin, cancellationController.completeRefund);
router.post('/admin/:id/cancel', isAdmin, cancellationController.clinicCancel);
router.post('/admin/:id/no-show', isAdmin, cancellationController.markNoShow);

// Lấy danh sách lịch hẹn (Patient xem của mình, Doctor xem danh sách khám, Admin xem toàn bộ)
router.get('/', appointmentController.getAppointments);
router.get('/:id', appointmentController.getAppointmentDetail);

// Chỉ cập nhật trạng thái khám; hủy lịch phải đi qua luồng yêu cầu/duyệt riêng.
router.patch('/:id/status', appointmentController.updateAppointmentStatus);

module.exports = router;

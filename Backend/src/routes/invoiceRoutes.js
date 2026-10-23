const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const verifyToken = require('../middlewares/verifyToken');
const { isAdmin, isPatient } = require('../middlewares/checkRole');

router.use(verifyToken);

// Lấy danh sách hóa đơn (Patient xem của mình, Admin xem toàn bộ)
router.get('/', invoiceController.getInvoices);
router.post('/:id/cash-request', isPatient, invoiceController.requestCashPayment);

// Admin / Thu ngân cập nhật trạng thái thanh toán
router.patch('/:id/pay', isAdmin, invoiceController.updatePaymentStatus);

module.exports = router;

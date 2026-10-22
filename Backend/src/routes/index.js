const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const aiRoutes = require('./aiRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const doctorRoutes = require('./doctorRoutes');
const medicalRecordRoutes = require('./medicalRecordRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const paymentRoutes = require('./paymentRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');

router.use('/auth', authRoutes);
router.use('/ai', aiRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'MediClinic Backend API is running smoothly!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const aiRoutes = require('./aiRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const doctorRoutes = require('./doctorRoutes');
const medicalRecordRoutes = require('./medicalRecordRoutes');
const invoiceRoutes = require('./invoiceRoutes');

router.use('/auth', authRoutes);
router.use('/ai', aiRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/doctors', doctorRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/invoices', invoiceRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'MediClinic Backend API is running smoothly!',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

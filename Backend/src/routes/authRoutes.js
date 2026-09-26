const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middlewares/verifyToken');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected route
router.get('/profile', verifyToken, authController.getProfile);

module.exports = router;

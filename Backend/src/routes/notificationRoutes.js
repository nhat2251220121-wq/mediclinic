const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/verifyToken');
const { isPatient } = require('../middlewares/checkRole');
const controller = require('../controllers/notificationController');

router.use(verifyToken, isPatient);
router.get('/', controller.listMine);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;

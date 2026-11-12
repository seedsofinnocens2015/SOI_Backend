const express = require('express');
const router = express.Router();
const { protectHrAuth } = require('../middleware/authMiddleware');
const {
  recordHeartbeat,
  recordLogout,
  getUserSessions,
} = require('../controller/userSessionController');

router.use(protectHrAuth);

router.post('/heartbeat', recordHeartbeat);
router.post('/logout', recordLogout);
router.get('/', getUserSessions);

module.exports = router;

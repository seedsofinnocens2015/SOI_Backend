const express = require('express');
const { getPerformanceReport } = require('../controller/performanceReportsController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectHrAuth, getPerformanceReport);

module.exports = router;

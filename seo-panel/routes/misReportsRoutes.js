const express = require('express');
const router = express.Router();
const { protectHrAuth } = require('../middleware/authMiddleware');
const { getMisReport, downloadMisData } = require('../controller/misReportsController');

router.use(protectHrAuth);

router.get('/', getMisReport);
router.get('/download', downloadMisData);

module.exports = router;

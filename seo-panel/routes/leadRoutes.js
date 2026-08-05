const express = require('express');
const { listLeads } = require('../controller/leadController');
const { protectSeoAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectSeoAuth, listLeads);

module.exports = router;

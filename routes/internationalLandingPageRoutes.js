const express = require('express');
const { createInternationalConsultation } = require('../controller/internationalLandingPage');

const router = express.Router();

// POST /api/internal-consultation
router.post('/', createInternationalConsultation);

module.exports = router;


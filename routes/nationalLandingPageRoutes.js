const express = require('express');
const { createNationalLandingPageLead } = require('../controller/nationalLandingPage');

const router = express.Router();

// POST /api/landing-pages
router.post('/', createNationalLandingPageLead);

module.exports = router;


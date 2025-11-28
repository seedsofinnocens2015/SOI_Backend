const express = require('express');
const { createWebsiteBooking } = require('../controller/websiteBookingPage');

const router = express.Router();

router.post('/', createWebsiteBooking);

module.exports = router;

const express = require('express');
const { createBookAppointment } = require('../controller/newWebsite/book-appointment');
const { createCallBackRequest } = require('../controller/newWebsite/call-back-form');

const router = express.Router();

router.post('/book-appointment', createBookAppointment);
router.post('/call-back-form', createCallBackRequest);

module.exports = router;

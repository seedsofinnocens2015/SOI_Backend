const express = require('express');
const {
  requestSignupOtp,
  verifySignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
} = require('../controller/authController');

const router = express.Router();

router.post('/signup/request-otp', requestSignupOtp);
router.post('/signup/verify-otp', verifySignupOtp);
router.post('/login/request-otp', requestLoginOtp);
router.post('/login/verify-otp', verifyLoginOtp);

module.exports = router;

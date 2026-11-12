const express = require('express');
const {
  requestSignupOtp,
  verifySignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  listSeoPanelUsers,
  listHrPanelUsers,
  getCurrentProfile,
  createPanelMember,
  updatePanelUser,
  deletePanelUser,
} = require('../controller/authController');
const { protectSeoAuth, protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup/request-otp', requestSignupOtp);
router.post('/signup/verify-otp', verifySignupOtp);
router.post('/login/request-otp', requestLoginOtp);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/password/forgot/request-otp', requestPasswordResetOtp);
router.post('/password/forgot/reset', resetPasswordWithOtp);
router.get('/me', protectHrAuth, getCurrentProfile);
router.get('/users/seo', protectSeoAuth, listSeoPanelUsers);
router.get('/users/hr', protectHrAuth, listHrPanelUsers);
router.post('/users', protectHrAuth, createPanelMember);
router.put('/users/:userId', protectHrAuth, updatePanelUser);
router.delete('/users/:userId', protectHrAuth, deletePanelUser);

module.exports = router;

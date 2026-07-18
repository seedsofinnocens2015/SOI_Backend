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
  updatePanelUser,
  deletePanelUser,
} = require('../controller/authController');
const { protectSeoAuth, protectHrAuth, protectFullAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup/request-otp', requestSignupOtp);
router.post('/signup/verify-otp', verifySignupOtp);
router.post('/login/request-otp', requestLoginOtp);
router.post('/login/verify-otp', verifyLoginOtp);
router.post('/password/forgot/request-otp', requestPasswordResetOtp);
router.post('/password/forgot/reset', resetPasswordWithOtp);
router.get('/users/seo', protectSeoAuth, listSeoPanelUsers);
router.get('/users/hr', protectHrAuth, listHrPanelUsers);
router.put('/users/:userId', protectFullAdmin, updatePanelUser);
router.delete('/users/:userId', protectFullAdmin, deletePanelUser);

module.exports = router;

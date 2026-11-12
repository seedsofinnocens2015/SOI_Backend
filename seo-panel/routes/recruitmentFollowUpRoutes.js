const express = require('express');
const {
  listFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} = require('../controller/recruitmentFollowUpController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protectHrAuth, listFollowUps);
router.post('/', protectHrAuth, createFollowUp);
router.put('/:id', protectHrAuth, updateFollowUp);
router.delete('/:id', protectHrAuth, deleteFollowUp);

module.exports = router;

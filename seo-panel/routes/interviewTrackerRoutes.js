const express = require('express');
const {
  listInterviews,
  listCandidateWise,
  createInterview,
  updateInterview,
  deleteInterview,
} = require('../controller/interviewTrackerController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listInterviews);
router.get('/candidate-wise', listCandidateWise);
router.post('/', createInterview);
router.put('/:id', updateInterview);
router.delete('/:id', deleteInterview);

module.exports = router;

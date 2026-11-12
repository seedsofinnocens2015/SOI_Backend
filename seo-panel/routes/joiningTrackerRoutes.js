const express = require('express');
const {
  listJoinings,
  createJoining,
  updateJoining,
  deleteJoining,
} = require('../controller/joiningTrackerController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listJoinings);
router.post('/', createJoining);
router.put('/:id', updateJoining);
router.delete('/:id', deleteJoining);

module.exports = router;

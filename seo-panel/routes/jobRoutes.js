const express = require('express');
const {
  listPublishedJobs,
  listManagedJobs,
  createJob,
  updateJob,
  deleteJob,
} = require('../controller/jobController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', listPublishedJobs);
router.get('/manage', protectHrAuth, listManagedJobs);
router.post('/', protectHrAuth, createJob);
router.put('/:id', protectHrAuth, updateJob);
router.delete('/:id', protectHrAuth, deleteJob);

module.exports = router;

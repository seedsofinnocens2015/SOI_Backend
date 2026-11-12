const express = require('express');
const {
  listChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
} = require('../controller/onboardingChecklistController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listChecklists);
router.post('/', createChecklist);
router.put('/:id', updateChecklist);
router.delete('/:id', deleteChecklist);

module.exports = router;

const express = require('express');
const {
  listRequisitions,
  getNextReqId,
  createRequisition,
  updateRequisition,
  deleteRequisition,
} = require('../controller/manpowerRequisitionController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listRequisitions);
router.get('/next-id', getNextReqId);
router.post('/', createRequisition);
router.put('/:id', updateRequisition);
router.delete('/:id', deleteRequisition);

module.exports = router;

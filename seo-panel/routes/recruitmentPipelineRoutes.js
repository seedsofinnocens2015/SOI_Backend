const express = require('express');
const {
  listPipeline,
  createPipelineEntry,
  updatePipelineEntry,
  deletePipelineEntry,
} = require('../controller/recruitmentPipelineController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listPipeline);
router.post('/', createPipelineEntry);
router.put('/:id', updatePipelineEntry);
router.delete('/:id', deletePipelineEntry);

module.exports = router;

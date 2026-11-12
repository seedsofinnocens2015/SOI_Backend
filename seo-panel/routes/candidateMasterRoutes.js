const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  listCandidates,
  getNextCandidateId,
  createCandidate,
  updateCandidate,
  deleteCandidate,
} = require('../controller/candidateMasterController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (
      allowedMimeTypes.has(file.mimetype) ||
      ['.pdf', '.doc', '.docx', '.txt'].includes(extension)
    ) {
      return callback(null, true);
    }
    return callback(new Error('Only PDF, DOC, DOCX and TXT files are allowed.'));
  },
});

function uploadResumeOptional(req, res, next) {
  upload.single('resume')(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ ok: false, error: error.message || 'Invalid resume upload.' });
  });
}

router.use(protectHrAuth);

router.get('/', listCandidates);
router.get('/next-id', getNextCandidateId);
router.post('/', uploadResumeOptional, createCandidate);
router.put('/:id', uploadResumeOptional, updateCandidate);
router.delete('/:id', deleteCandidate);

module.exports = router;

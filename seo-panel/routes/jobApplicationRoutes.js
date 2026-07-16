const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  createApplication,
  listApplications,
  getApplication,
  downloadResume,
  updateApplicationStatus,
} = require('../controller/jobApplicationController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !['.pdf', '.doc', '.docx'].includes(extension)) {
      return callback(new Error('Only PDF, DOC and DOCX resumes are allowed.'));
    }
    return callback(null, true);
  },
});

function uploadResume(req, res, next) {
  upload.single('resume')(req, res, error => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Resume/CV must be 5MB or smaller.'
      : error.message || 'Invalid resume upload.';
    return res.status(400).json({ ok: false, error: message });
  });
}

router.post('/', uploadResume, createApplication);
router.get('/manage', protectHrAuth, listApplications);
router.get('/:id', protectHrAuth, getApplication);
router.get('/:id/resume', protectHrAuth, downloadResume);
router.patch('/:id/status', protectHrAuth, updateApplicationStatus);

module.exports = router;

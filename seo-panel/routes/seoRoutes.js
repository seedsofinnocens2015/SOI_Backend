const express = require('express');
const { saveSeo, getSeo, getSeoResolved, getSeoStats } = require('../controller/seoController');
const { protectSeoAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/resolved', getSeoResolved);
// Public read is retained because the main website resolves live metadata here.
router.get('/', getSeo);
router.post('/stats', protectSeoAuth, getSeoStats);
// Retain GET temporarily for older panel builds with small requests.
router.get('/stats', protectSeoAuth, getSeoStats);
router.post('/', protectSeoAuth, saveSeo);
router.put('/', protectSeoAuth, saveSeo);

module.exports = router;

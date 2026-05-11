const express = require('express');
const { saveSeo, getSeo, getSeoResolved, getSeoStats } = require('../controller/seoController');
const { protectSeoAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/resolved', getSeoResolved);
router.get('/', getSeo);
router.get('/stats', protectSeoAuth, getSeoStats);
router.post('/', protectSeoAuth, saveSeo);
router.put('/', protectSeoAuth, saveSeo);

module.exports = router;

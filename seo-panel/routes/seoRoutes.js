const express = require('express');
const { saveSeo, getSeo } = require('../controller/seoController');

const router = express.Router();

router.post('/', saveSeo);
router.put('/', saveSeo);
router.get('/', getSeo);

module.exports = router;

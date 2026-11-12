const express = require('express');
const {
  listOffers,
  createOffer,
  updateOffer,
  deleteOffer,
} = require('../controller/offerTrackerController');
const { protectHrAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protectHrAuth);

router.get('/', listOffers);
router.post('/', createOffer);
router.put('/:id', updateOffer);
router.delete('/:id', deleteOffer);

module.exports = router;

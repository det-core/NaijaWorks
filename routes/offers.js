const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/offersController');

router.get('/',           requireAuth, ctrl.listOffers);
router.get('/:id',        requireAuth, ctrl.getOffer);
router.post('/',          requireAuth, ctrl.createOffer);
router.patch('/:id/accept',  requireAuth, ctrl.acceptOffer);
router.patch('/:id/decline', requireAuth, ctrl.declineOffer);
router.patch('/:id/counter', requireAuth, ctrl.counterOffer);

module.exports = router;

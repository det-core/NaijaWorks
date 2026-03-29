const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reviewsController');

router.get('/',       ctrl.listReviews);
router.post('/',      requireAuth, ctrl.createReview);

module.exports = router;

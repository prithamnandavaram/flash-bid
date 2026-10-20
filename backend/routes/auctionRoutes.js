const express = require('express');
const router = express.Router();
const {
    getAuctions,
    getAuctionById,
    createAuction,
    placeBid,
} = require('../controllers/auctionController');
const { protect } = require('../middleware/authMiddleware');
const rateLimiter = require('../middleware/rateLimiter');

router.get('/', getAuctions);
router.get('/:id', getAuctionById);
router.post('/', protect, createAuction);
router.post('/:id/bid', protect, rateLimiter, placeBid);


module.exports = router;

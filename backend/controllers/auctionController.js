const Item = require('../models/Item');

// @desc    Get all active auctions
// @route   GET /api/auctions
// @access  Public
const getAuctions = async (req, res) => {
    try {
        const items = await Item.find({ isClosed: false })
            .populate('highestBidder', 'name') // Fetch winner's name
            .sort({ endTime: 1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single auction
// @route   GET /api/auctions/:id
// @access  Public
const getAuctionById = async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).populate('highestBidder', 'name');

        if (item) {
            res.json(item);
        } else {
            res.status(404).json({ message: 'Auction not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new auction (For testing/seeding)
// @route   POST /api/auctions
// @access  Private
const createAuction = async (req, res) => {
    const { name, description, startingPrice, endTime } = req.body;

    try {
        const item = await Item.create({
            name,
            description,
            startingPrice,
            currentPrice: startingPrice,
            endTime,
            createdBy: req.user._id
        });
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Place a bid
// @route   POST /api/auctions/:id/bid
// @access  Private
const placeBid = async (req, res) => {
    const { amount } = req.body;

    try {
        const item = await Item.findById(req.params.id);

        if (!item) {
            return res.status(404).json({ message: 'Auction not found' });
        }

        if (item.isClosed || new Date() > new Date(item.endTime)) {
            return res.status(400).json({ message: 'Auction has ended' });
        }

        // Check ownership
        console.log(`Bidder: ${req.user._id}, Owner: ${item.createdBy}`); // DEBUG LOG
        if (item.createdBy.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot bid on your own auction!' });
        }

        if (amount <= item.currentPrice) {
            return res.status(400).json({ message: 'Bid must be higher than current price' });
        }

        // Update Price
        item.currentPrice = amount;
        item.highestBidder = req.user._id;
        await item.save();

        // Populate bidder name for real-time broadcast
        await item.populate('highestBidder', 'name');

        // 📡 Emit Socket.IO event to all connected clients
        const io = req.app.get('io');
        io.emit('bid_placed', {
            auctionId: item._id,
            currentPrice: item.currentPrice,
            highestBidder: item.highestBidder,
            bidderName: item.highestBidder?.name || 'Unknown'
        });

        console.log(`📡 Socket.IO: Broadcast bid for auction ${item._id} at $${amount}`);

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAuctions,
    getAuctionById,
    createAuction,
    placeBid,
};

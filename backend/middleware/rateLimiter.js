const redisClient = require('../config/redis');

// Token Bucket Configuration
const BUCKET_CAPACITY = 10; // Max burst bids allowed
const REFILL_RATE = 1; // Tokens added per second
const REFILL_INTERVAL = 10; // Seconds required to gain 1 token (Example: 1 token every 10 seconds)
// A better setup for "Bidding War":
// Allow 10 bids instantly.
// Then refill 1 bid every 5 seconds.

const rateLimiter = async (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `rate_limit:${ip}`;

    try {
        // Fetch current bucket state
        // We store as a hash: { tokens: number, lastRefill: timestamp }
        const data = await redisClient.hGetAll(key);

        const now = Date.now();
        let tokens = BUCKET_CAPACITY;
        let lastRefill = now;

        if (data.tokens) {
            tokens = parseFloat(data.tokens);
            lastRefill = parseInt(data.lastRefill);
        }

        // Calculate Refill
        // Time elapsed in Seconds
        const elapsedSeconds = (now - lastRefill) / 1000;
        // Tokens to add: (elapsed / wait_time_for_1_token)
        // Let's say we want 1 token every 5 seconds.
        const refillAmount = elapsedSeconds / 5;

        tokens = Math.min(BUCKET_CAPACITY, tokens + refillAmount);

        if (tokens >= 1) {
            tokens -= 1;
            // Update Redis
            await redisClient.hSet(key, {
                tokens: tokens.toString(),
                lastRefill: now.toString()
            });
            // Set expiry to clean up old keys (e.g., 1 hour)
            await redisClient.expire(key, 3600);

            console.log(`Bid Allowed for ${ip}. Tokens left: ${tokens.toFixed(2)}`); // DEBUG
            next();
        } else {
            console.log(`Rate Limit Blocked for ${ip}. Tokens: ${tokens.toFixed(2)}`); // DEBUG
            const waitTime = Math.ceil((1 - tokens) * 5); // Seconds to wait for next token
            res.status(429).json({ message: `Too many bids! Burst limit reached. Wait ${waitTime}s.` });
        }

    } catch (error) {
        console.error('Rate Limiter Error:', error);
        // Fail Open (Allow bid if Redis breaks)
        next();
    }
};

module.exports = rateLimiter;

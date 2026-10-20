const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5174', // Frontend URL
        methods: ['GET', 'POST']
    }
});

// Redis Adapter for Socket.IO (enables multi-instance support)
const setupRedisAdapter = async () => {
    try {
        const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.IO Redis Adapter connected');
    } catch (error) {
        console.error('❌ Redis Adapter Error:', error);
        // Continue without adapter in development
    }
};

setupRedisAdapter();

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(express.json()); // Body parser
app.use(cors()); // Enable CORS

// Socket.IO Connection Handler
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
    });
});

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('Flash-Bid API is running...');
});

// Define Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/auctions', require('./routes/auctionRoutes'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} with Socket.IO`));

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const Item = require('./models/Item');
const User = require('./models/User');

dotenv.config();
connectDB();

const seedData = async () => {
    try {
        await Item.deleteMany();
        await User.deleteMany(); // Clear users too for a fresh start

        // Create a Seed User
        const user = await User.create({
            name: 'Seed Seller',
            email: 'seller@example.com',
            password: await require('bcryptjs').hash('password123', 10)
        });

        // Create Seed Auction
        const item = await Item.create({
            name: 'Sony PlayStation 5 Pro',
            description: 'Brand new PS5 Pro console. 60-second flash sale!',
            startingPrice: 500,
            currentPrice: 500,
            endTime: new Date(Date.now() + 60 * 1000), // Ends in 1 minute
            createdBy: user._id
        });

        console.log('Auction Seeded by:', user.name);
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

seedData();

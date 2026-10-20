import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const Dashboard = () => {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newAuction, setNewAuction] = useState({ name: '', description: '', startingPrice: '', duration: '1' });
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        // Initial fetch
        fetchAuctions();

        // 📡 Socket.IO Connection (replaces polling)
        const socket = io('http://localhost', {
            path: '/socket.io/',
            transports: ['websocket']
        });

        socket.on('connect', () => {
            console.log('✅ Connected to Socket.IO server');
        });

        // Listen for real-time bid updates
        socket.on('bid_placed', (data) => {
            console.log('📡 Received bid update:', data);

            // Update the specific auction in state
            setAuctions(prevAuctions =>
                prevAuctions.map(auction =>
                    auction._id === data.auctionId
                        ? {
                            ...auction,
                            currentPrice: data.currentPrice,
                            highestBidder: data.highestBidder
                        }
                        : auction
                )
            );
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Socket.IO server');
        });

        // Cleanup on unmount
        return () => {
            socket.disconnect();
        };
    }, [user, navigate]);

    const fetchAuctions = async () => {
        try {
            const res = await api.get('/auctions');
            setAuctions(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePostAuction = async (e) => {
        e.preventDefault();
        try {
            // Calculate end time based on duration (minutes)
            const endTime = new Date(Date.now() + newAuction.duration * 60 * 1000);

            await api.post('/auctions', {
                name: newAuction.name,
                description: newAuction.description,
                startingPrice: Number(newAuction.startingPrice),
                endTime,
            });

            setNewAuction({ name: '', description: '', startingPrice: '', duration: '' });
            fetchAuctions(); // Refresh list
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create auction');
        }
    };

    const handleBid = async (id, currentPrice) => {
        try {
            await api.post(`/auctions/${id}/bid`, { amount: currentPrice + 1 });
            // No need to call fetchAuctions() - Socket.IO will update automatically!
        } catch (err) {
            alert(err.response?.data?.message || 'Bid failed');
        }
    };


    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (loading) return <div>Loading Auctions...</div>;

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: 'auto', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
            {/* Header */}
            <header style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '3rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid #333'
            }}>
                <h1 style={{ margin: 0, fontSize: '2rem', background: 'linear-gradient(45deg, #FF512F, #DD2476)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    🔥 Flash-Bid
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <span style={{ color: '#ccc' }}>Welcome, <strong style={{ color: '#fff' }}>{user?.name}</strong></span>
                    <button onClick={handleLogout} style={{
                        padding: '0.6rem 1.2rem',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}>
                        Logout
                    </button>
                </div>
            </header>

            {/* Create Auction Section */}
            <section style={{
                marginBottom: '4rem',
                padding: '2rem',
                background: '#1a1a1a',
                borderRadius: '12px',
                border: '1px solid #333'
            }}>
                <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem' }}>List New Item</h2>
                <form onSubmit={handlePostAuction} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#888' }}>Item Name</label>
                        <input type="text" placeholder="e.g. iPhone 15 Pro" value={newAuction.name} onChange={(e) => setNewAuction({ ...newAuction, name: e.target.value })} required
                            style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #444', background: '#2d2d2d', color: 'white', outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#888' }}>Description</label>
                        <input type="text" placeholder="Short description..." value={newAuction.description} onChange={(e) => setNewAuction({ ...newAuction, description: e.target.value })} required
                            style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #444', background: '#2d2d2d', color: 'white', outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#888' }}>Start Price ($)</label>
                        <input type="number" placeholder="100" value={newAuction.startingPrice} onChange={(e) => setNewAuction({ ...newAuction, startingPrice: e.target.value })} required
                            style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #444', background: '#2d2d2d', color: 'white', outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.9rem', color: '#888' }}>Duration (Mins)</label>
                        <input type="number" placeholder="5" value={newAuction.duration} onChange={(e) => setNewAuction({ ...newAuction, duration: e.target.value })} required
                            style={{ padding: '0.8rem', borderRadius: '6px', border: '1px solid #444', background: '#2d2d2d', color: 'white', outline: 'none' }} />
                    </div>

                    <button type="submit" style={{
                        marginTop: 'auto',
                        padding: '0.8rem',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        height: '46px'
                    }}>
                        Post Auction
                    </button>
                </form>
            </section>

            <h2 style={{ marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem', display: 'inline-block' }}>Live Auctions</h2>
            <div style={{ display: 'grid', gap: '2rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {auctions.map((item) => {
                    const timeLeft = new Date(item.endTime) - new Date();
                    const isEnded = timeLeft <= 0;

                    return (
                        <div key={item._id} style={{
                            border: '1px solid #333',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            background: '#1a1a1a',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'transform 0.2s',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: isEnded ? 'red' : '#28a745' }}></div>

                            <h3 style={{ margin: '0.5rem 0 0.5rem 0', fontSize: '1.4rem' }}>{item.name}</h3>
                            <p style={{ color: '#aaa', margin: '0 0 1.5rem 0', lineHeight: '1.4' }}>{item.description}</p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Price</span>
                                    <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>${item.currentPrice}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginBottom: '4px' }}>Time Remaining</span>
                                    <span style={{
                                        fontSize: '1rem',
                                        color: isEnded ? '#ff4d4d' : '#28a745',
                                        fontWeight: 'bold',
                                        background: isEnded ? 'rgba(255, 77, 77, 0.1)' : 'rgba(40, 167, 69, 0.1)',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        {isEnded ? 'SOLD' : `${Math.floor(timeLeft / 1000)}s`}
                                    </span>
                                </div>
                            </div>

                            <div style={{
                                fontSize: '0.9rem',
                                color: '#ddd',
                                marginBottom: '1rem',
                                padding: '0.8rem',
                                background: '#2d2d2d',
                                borderRadius: '6px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                border: isEnded ? '1px solid #28a745' : '1px solid #444' // Green border if won
                            }}>
                                <span>{isEnded ? 'Winner:' : 'Highest Bidder:'}</span>
                                <strong style={{ color: isEnded ? '#28a745' : 'white' }}>
                                    {item.highestBidder?.name || 'No bids'}
                                </strong>
                            </div>

                            {!isEnded && (
                                <button
                                    onClick={() => handleBid(item._id, item.currentPrice)}
                                    style={{
                                        width: '100%',
                                        padding: '1rem',
                                        background: '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontSize: '1.1rem',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 6px rgba(0, 123, 255, 0.2)'
                                    }}
                                >
                                    BID +$1
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Dashboard;

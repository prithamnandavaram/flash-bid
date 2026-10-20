# ⚡ Flash-Bid

> A real-time micro-auction platform where the thrill is in the **60-second window**. Built with Node.js, Socket.IO, Redis, MongoDB, and Docker — horizontally scaled and production-ready.

<br/>

![Architecture Diagram](assets/architecture.jpg)

<br/>

---

## 🤔 What even is this?

You know how eBay auctions can drag on for *days*? Flash-Bid flips that. Each auction lasts **60 seconds**. You get instant bid updates via WebSockets (no page refresh needed), and the whole thing runs across **3 horizontally scaled backend instances** behind an Nginx load balancer — so it doesn't fall over when things get spicy.

Oh, and it has a **Token Bucket rate limiter** in Redis so bots can't just spam bids.

---

## 🏗️ How it all fits together

*(the whimsical version is above — here's the text version for robots and ctrl+F lovers)*

```
Browser
  │
  │  WebSocket + HTTP
  ▼
┌─────────────────────────┐
│  Nginx  (Port 80)       │  ← Round-robin load balancer
└───────┬─────────────────┘
        │
   ┌────┴────┬──────────┐
   ▼         ▼          ▼
[Node 1]  [Node 2]  [Node 3]   ← 3 Express + Socket.IO instances
   │         │          │
   └────┬────┴──────────┘
        │  Redis Pub/Sub keeps them all in sync
        │
   ┌────┴────────────────┐
   ▼                     ▼
[MongoDB]             [Redis]
 Auctions & Users    Rate Limits & Pub/Sub
```

**Why 3 instances?** If one crashes, 2 remain → 66% uptime vs total outage. With Redis Pub/Sub, all 3 share Socket.IO state so every client gets every bid update, regardless of which instance they connected to.

---

## 📊 By the numbers

![Metrics](assets/metrics.jpg)

| Metric | Before (Polling) | After (WebSocket) |
|--------|------------------|--------------------|
| **Update Latency** | 0–1000ms 😩 | <100ms 🚀 |
| **Server Requests** | ~1000 req/s for 1000 users | ~10 req/s (persistent conns) |
| **Scalability** | Single instance | 3 instances, 1 `docker-compose up` |
| **Fault Tolerance** | 0% if server goes down | 66% if 1/3 goes down |

> The latency drop is real: polling means every client asks "any updates?" every 1s. WebSocket is a permanent pipe — the server *pushes* updates in ~<10ms. The "1000 req/s" becomes basically 0.

---

## 🛠️ Tech Stack

### Backend
- **Node.js + Express** — REST API + WebSocket server
- **Socket.IO** — Real-time bid broadcasting
- **MongoDB + Mongoose** — Auction & user data
- **Redis (ioredis)** — Token Bucket rate limiting + Socket.IO multi-instance Pub/Sub
- **JWT + Bcrypt** — Auth

### Frontend
- **React 18 + Vite** — Fast dev, lean bundle
- **Socket.IO Client** — Listens for live bid events
- **Axios** — HTTP client with JWT interceptors

### Infrastructure
- **Docker + Docker Compose** — One command to run everything
- **Nginx** — Load balancer + reverse proxy + WebSocket support
- **3 backend replicas** — Horizontal scaling out of the box

---

## 🧠 Interesting bits (the "why did you do it that way?" section)

### Token Bucket Rate Limiter (not just `express-rate-limit`)
```javascript
// rateLimiter.js — the core logic
const BUCKET_CAPACITY = 10;  // burst: 10 bids instantly
// refills 1 token every 5 seconds

const elapsedSeconds = (now - lastRefill) / 1000;
const refillAmount = elapsedSeconds / 5;
tokens = Math.min(BUCKET_CAPACITY, tokens + refillAmount);

if (tokens >= 1) {
    tokens -= 1;
    // ✅ allow bid
} else {
    const waitTime = Math.ceil((1 - tokens) * 5);
    res.status(429).json({ message: `Wait ${waitTime}s` });
}
```

**Why Token Bucket over a simple "X per minute" counter?** Because at the end of a hot auction, real humans *do* spam bids — Token Bucket allows that natural burst (10 back-to-back) and then smoothly rate-limits sustained spamming. A fixed window counter either allows too much or blocks legitimate burst behaviour.

State is stored in Redis (not in-memory) so all 3 instances share the same counter per IP.

---

### Redis Pub/Sub adapter for Socket.IO
```javascript
// Without this, a bid on Node 1 only broadcasts to clients on Node 1
// With Redis adapter: broadcast goes to ALL clients on ALL 3 nodes
io.adapter(createAdapter(pubClient, subClient));
```

This was the trickiest part to get right. Without Redis, a user on Node 2 wouldn't see a bid placed via Node 1. Redis Pub/Sub acts as the message bus that syncs events across instances.

---

### Self-bid prevention
```javascript
if (item.createdBy.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: 'You cannot bid on your own auction!' });
}
```

Simple, but easy to forget. Prevents sellers from inflating their own auction price.

---

## 🚀 Running it locally

### Prerequisites
- Docker Desktop (that's literally it)

### One command
```bash
git clone https://github.com/prithamnandavaram/flash-bid.git
cd flash-bid

# Copy the env template
cp backend/.env.example backend/.env
# Edit it to set your JWT_SECRET (or leave defaults for local dev)

docker-compose up -d --build
```

That spins up: Redis, MongoDB, 3 backend instances, Nginx, and the React frontend.

### Access
| Service | URL |
|---------|-----|
| Frontend | http://localhost |
| API (via Nginx) | http://localhost/api |
| Backend 1 (direct) | http://localhost:5001 |
| Backend 2 (direct) | http://localhost:5002 |
| Backend 3 (direct) | http://localhost:5003 |

---

## 🧪 Quick tests

**Test real-time bidding:**
1. Open 2 browser tabs
2. Register 2 different accounts
3. Create an auction in Tab 1
4. Place a bid from Tab 2
5. Watch Tab 1 update *instantly* without refresh ✅

**Test load balancing:**
```bash
# Hit the API 10 times — check which backend handles each
for i in {1..10}; do curl -s http://localhost/api/auctions > /dev/null; done
docker-compose logs backend-1 backend-2 backend-3 | grep "GET /api/auctions"
```

**Test rate limiting:**
```bash
# Spam 15 bids — first 10 pass, next 5 get 429
# (use a REST client like Insomnia or httpie)
```

---

## 📁 Project structure

```
flash-bid/
├── backend/
│   ├── config/          # MongoDB + Redis connections
│   ├── controllers/     # auctionController.js, authController.js
│   ├── middleware/       # authMiddleware.js, rateLimiter.js ← the good stuff
│   ├── models/           # Mongoose schemas
│   ├── routes/           # REST API routes
│   ├── server.js         # Entry point: Express + Socket.IO + Redis adapter
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/        # Dashboard, Login, Register
│   │   ├── api.js        # Axios + JWT interceptor config
│   │   └── App.jsx
│   ├── nginx.conf        # Serves static build in prod
│   └── Dockerfile
├── nginx/
│   ├── nginx.conf        # Upstream block + round-robin + WebSocket proxy
│   └── Dockerfile
├── assets/
│   ├── architecture.jpg  # The whimsical flowchart up top 👆
│   └── metrics.jpg       # The numbers chart
└── docker-compose.yml    # Orchestrates all 6 services
```

---

## 🚧 What's next

- [ ] Auto-close auctions when `endTime` is reached (need a cron job or TTL trigger)
- [ ] Payment integration (Stripe)
- [ ] Bid history per auction
- [ ] Image uploads for auction items (S3)
- [ ] Email notifications for outbid events
- [ ] GitHub Actions CI/CD pipeline
- [ ] Kubernetes deployment (HPA for auto-scaling)

---

## 👤 Author

**Pritham Nandavaram**
- GitHub: [@prithamnandavaram](https://github.com/prithamnandavaram)

---

*Built as a portfolio project demonstrating real-time systems, distributed state management, and production-grade containerization.*

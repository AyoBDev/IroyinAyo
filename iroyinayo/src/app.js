const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const studentRoutes = require('./modules/students/students.routes');
const contentRoutes = require('./modules/content/content.routes');
const gamificationRoutes = require('./modules/gamification/gamification.routes');
const marketRoutes = require('./modules/markets/markets.routes');
const multiMarketRoutes = require('./modules/markets/multiMarkets.routes');
const rewardRoutes = require('./modules/rewards/rewards.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const { generalLimiter } = require('./middleware/rateLimiter');
const { AppError } = require('./utils/errors');

const app = express();

app.set('trust proxy', 1);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : [];

if (corsOrigins.length) {
  console.log('CORS allowed origins:', corsOrigins);
}

app.use(cors({
  origin: corsOrigins.length ? corsOrigins : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet());

app.use(generalLimiter);

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/bot/qr', (req, res) => {
  const { getLatestQR } = require('./bot/connection');
  const qr = getLatestQR();
  if (!qr) return res.json({ status: 'connected_or_waiting', qr: null });
  res.json({ status: 'needs_pairing', qr });
});

app.use('/api/students', studentRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/multi-markets', multiMarketRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'public');
app.use(express.static(frontendPath));

// SPA fallback — serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

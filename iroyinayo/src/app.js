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
const authRoutes = require('./modules/auth/auth.routes');
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
  origin: corsOrigins.length ? corsOrigins : (process.env.NODE_ENV === 'production' ? false : true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(generalLimiter);

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const { authenticate } = require('./middleware/auth');
app.get('/api/bot/qr', authenticate, (req, res) => {
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
app.use('/api/auth', authRoutes);

// Serve frontend static files
const fs = require('fs');
const possiblePaths = [
  path.join(__dirname, '..', 'public'),
  path.join(process.cwd(), 'public'),
  path.join(__dirname, '..', '..', 'prediction-web', 'dist'),
];
const frontendPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possiblePaths[0];
console.log('Serving frontend from:', frontendPath, '| exists:', fs.existsSync(path.join(frontendPath, 'index.html')));

app.use(express.static(frontendPath));

// SPA fallback — serve index.html for non-API routes
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/socket.io')) return next();
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('<html><body><h1>IroyinMarket</h1><p>Frontend not deployed yet. Use WhatsApp bot to interact.</p></body></html>');
  }
});

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

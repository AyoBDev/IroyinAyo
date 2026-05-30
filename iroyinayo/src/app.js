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
const referralRoutes = require('./modules/referrals/referrals.routes');
const ambassadorRoutes = require('./modules/markets/ambassador.routes');
const ambassadorAdminRoutes = require('./modules/markets/ambassadorAdmin.routes');
const schedulerRoutes = require('./modules/markets/scheduler.routes');
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
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Serve static files before rate limiter to avoid throttling asset requests
const fs = require('fs');
const possiblePaths = [
  path.join(__dirname, '..', 'public'),
  path.join(process.cwd(), 'public'),
  path.join(__dirname, '..', '..', 'prediction-web', 'dist'),
];
const frontendPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'index.html'))) || possiblePaths[0];
console.log('Serving frontend from:', frontendPath, '| exists:', fs.existsSync(path.join(frontendPath, 'index.html')));

// Admin static export routing — must come before express.static to prevent directory redirects
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.path.startsWith('/admin')) return next();
  if (req.path.includes('.')) return next();
  const subPath = req.path.replace(/^\/admin\/?/, '').replace(/\/$/, '');
  const candidates = subPath
    ? [path.join(frontendPath, 'admin', subPath + '.html'), path.join(frontendPath, 'admin', subPath, 'index.html')]
    : [path.join(frontendPath, 'admin', 'index.html')];
  const match = candidates.find(p => fs.existsSync(p));
  if (match) {
    res.sendFile(match);
  } else {
    const adminIndex = path.join(frontendPath, 'admin', 'index.html');
    if (fs.existsSync(adminIndex)) {
      res.sendFile(adminIndex);
    } else {
      next();
    }
  }
});

app.use(express.static(frontendPath));

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
app.use('/api/referrals', referralRoutes);
app.use('/api/ambassador', ambassadorRoutes);
app.use('/api/ambassador-admin', ambassadorAdminRoutes);
app.use('/api/schedules', schedulerRoutes);


// OG tags for share pages (crawlers don't run JS)
app.get('/share/:marketId', async (req, res, next) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const isBot = /bot|crawl|spider|facebook|twitter|whatsapp|telegram|slack|discord|linkedin/i.test(ua);

  if (!isBot) {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  }

  try {
    const multiMarkets = require('./modules/markets/multiMarkets.service');
    const market = await multiMarkets.getMarketWithOdds(req.params.marketId);
    const winner = market.status === 'resolved'
      ? market.outcomes.find(o => o.id === market.winner_outcome_id)
      : null;
    const topOutcome = [...market.outcomes].sort((a, b) => b.price - a.price)[0];

    const title = winner
      ? `${winner.label} won! — ${market.title}`
      : `${topOutcome?.label} leads at ${Math.round((topOutcome?.price || 0) * 100)}% — ${market.title}`;
    const description = winner
      ? `${winner.label} just won "${market.title}" on IroyinMarket! Make your predictions and compete for cash prizes.`
      : `${market.outcomes.length} options, live odds. Predict now on IroyinMarket!`;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta property="og:title" content="${title.replace(/"/g, '&quot;')}"/>
<meta property="og:description" content="${description.replace(/"/g, '&quot;')}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${baseUrl}/share/${market.id}"/>
<meta property="og:site_name" content="IroyinMarket"/>
<meta name="twitter:card" content="summary"/>
<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}"/>
<meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}"/>
<title>${title.replace(/</g, '&lt;')}</title>
<meta http-equiv="refresh" content="0;url=${baseUrl}/share/${market.id}"/>
</head>
<body></body>
</html>`);
  } catch {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send('Market not found');
  }
});

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

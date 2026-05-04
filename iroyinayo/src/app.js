const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const studentRoutes = require('./modules/students/students.routes');
const contentRoutes = require('./modules/content/content.routes');
const gamificationRoutes = require('./modules/gamification/gamification.routes');
const marketRoutes = require('./modules/markets/markets.routes');
const rewardRoutes = require('./modules/rewards/rewards.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const { generalLimiter } = require('./middleware/rateLimiter');
const { AppError } = require('./utils/errors');

const app = express();

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : [];

if (corsOrigins.length) {
  console.log('CORS allowed origins:', corsOrigins);
}

app.use(cors({
  origin: corsOrigins.length ? corsOrigins : false,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(helmet());

app.use(generalLimiter);

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/students', studentRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/rewards', rewardRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

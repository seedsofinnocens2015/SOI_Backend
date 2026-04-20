require('dotenv').config();
const express = require('express');
const cors = require('cors');

const websiteBookingRoutes = require('./routes/websiteBookingPageRoutes');
const internationalLandingRoutes = require('./routes/internationalLandingPageRoutes');
const nationalLandingRoutes = require('./routes/nationalLandingPageRoutes');
const newWebsiteRoutes = require('./routes/newWebsiteRoutes');
const seoPanelRoutes = require('./routes/seoPanelRoutes');
const { connectDatabase } = require('./config/database');
const seoPanelController = require('./controller/seoPanel/seoPanelController');
const { redirectMiddleware } = require('./middleware/seoPanel/redirectMiddleware');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, '').toLowerCase())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server/non-browser requests (no Origin header).
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();
    if (!allowedOrigins.length || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(redirectMiddleware);

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/website-bookings', websiteBookingRoutes);
app.use('/api/internal-consultation', internationalLandingRoutes);
app.use('/api/landing-pages', nationalLandingRoutes);
app.use('/api/new-website', newWebsiteRoutes);
app.use('/api/seo-panel', seoPanelRoutes);
app.get('/sitemap.xml', seoPanelController.getSitemapXml);
app.get('/robots.txt', seoPanelController.getRobotsTxt);

app.use((err, _req, res, _next) => {
  if (err && err.message && err.message.startsWith('CORS blocked for origin:')) {
    return res.status(403).json({ ok: false, error: err.message });
  }

  console.error('Unhandled error', err);
  return res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

const bootstrap = async () => {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Database connection failed', error.message);
    // In production/serverless, keep process alive so health/CORS responses still work.
    if (process.env.NODE_ENV !== 'production' || process.env.FAIL_ON_DB_ERROR === 'true') {
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
};

if (process.env.VERCEL === '1') {
  connectDatabase().catch((error) => {
    console.error('Database connection failed', error.message);
  });
} else {
  bootstrap();
}

module.exports = app;


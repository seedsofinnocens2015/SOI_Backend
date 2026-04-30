require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const websiteBookingRoutes = require('./routes/websiteBookingPageRoutes');
const internationalLandingRoutes = require('./routes/internationalLandingPageRoutes');
const nationalLandingRoutes = require('./routes/nationalLandingPageRoutes');
const newWebsiteRoutes = require('./routes/newWebsiteRoutes');
const seoRoutes = require('./seo-panel/routes/seoRoutes');
const seoAuthRoutes = require('./seo-panel/routes/authRoutes');

const app = express();
const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI 

mongoose.set('strictQuery', true);
mongoose.connection.on('error', err => console.error('Mongo Error:', err));
mongoose.connection.on('disconnected', () => console.warn('MongoDB Disconnected'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const effectiveAllowedOrigins = Array.from(new Set([...allowedOrigins, ...defaultDevOrigins]));

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (Postman/curl) and same-origin server calls.
      if (!origin) {
        return callback(null, true);
      }

      if (effectiveAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/website-bookings', websiteBookingRoutes);
app.use('/api/internal-consultation', internationalLandingRoutes);
app.use('/api/landing-pages', nationalLandingRoutes);
app.use('/api/new-website', newWebsiteRoutes);
app.use('/api/seo-auth', seoAuthRoutes);
app.use('/api/seo', seoRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

const startServer = async () => {
  try {
    if (!MONGO_URI) {
      console.error('[MongoDB] Missing MONGO_URI in environment variables');
      process.exit(1);
    }

    // console.log('[MongoDB] Starting connection...');
    // console.log('Connecting to MongoDB with URI:', MONGO_URI);
    await mongoose.connect(MONGO_URI, {
      family: 4,
    });
    console.log('MongoDB Connected Successfully');

    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

startServer();

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const runtimeConfig = require('./config/runtimeConfig');

const websiteBookingRoutes = require('./routes/websiteBookingPageRoutes');
const internationalLandingRoutes = require('./routes/internationalLandingPageRoutes');
const nationalLandingRoutes = require('./routes/nationalLandingPageRoutes');
const newWebsiteRoutes = require('./routes/newWebsiteRoutes');
const seoRoutes = require('./seo-panel/routes/seoRoutes');
const seoAuthRoutes = require('./seo-panel/routes/authRoutes');

const app = express();
const PORT = process.env.PORT || runtimeConfig.PORT;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || runtimeConfig.MONGO_URI;
let mongoConnectionPromise = null;

mongoose.set('strictQuery', true);
mongoose.connection.on('error', err => console.error('Mongo Error:', err));
mongoose.connection.on('disconnected', () => console.warn('MongoDB Disconnected'));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || runtimeConfig.ALLOWED_ORIGINS || '')
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

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoConnectionPromise) {
    return mongoConnectionPromise;
  }

  if (!MONGO_URI) {
    throw new Error('Missing MONGO_URI in environment variables');
  }

  mongoConnectionPromise = mongoose
    .connect(MONGO_URI, { family: 4 })
    .then(() => {
      console.log('MongoDB Connected Successfully');
      return mongoose.connection;
    })
    .catch((err) => {
      mongoConnectionPromise = null;
      throw err;
    });

  return mongoConnectionPromise;
};

app.use(async (_req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    res.status(500).json({ ok: false, error: 'Database connection failed' });
  }
});

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
    await connectToDatabase();

    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

if (!process.env.VERCEL) {
  startServer();
}

module.exports = app;

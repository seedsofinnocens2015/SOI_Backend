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
const jobRoutes = require('./seo-panel/routes/jobRoutes');
const jobApplicationRoutes = require('./seo-panel/routes/jobApplicationRoutes');
const leadRoutes = require('./seo-panel/routes/leadRoutes');
const manpowerRequisitionRoutes = require('./seo-panel/routes/manpowerRequisitionRoutes');
const candidateMasterRoutes = require('./seo-panel/routes/candidateMasterRoutes');
const recruitmentPipelineRoutes = require('./seo-panel/routes/recruitmentPipelineRoutes');
const interviewTrackerRoutes = require('./seo-panel/routes/interviewTrackerRoutes');
const offerTrackerRoutes = require('./seo-panel/routes/offerTrackerRoutes');
const joiningTrackerRoutes = require('./seo-panel/routes/joiningTrackerRoutes');
const onboardingChecklistRoutes = require('./seo-panel/routes/onboardingChecklistRoutes');
const recruitmentFollowUpRoutes = require('./seo-panel/routes/recruitmentFollowUpRoutes');
const performanceReportsRoutes = require('./seo-panel/routes/performanceReportsRoutes');
const masterSettingsRoutes = require('./seo-panel/routes/masterSettingsRoutes');
const misReportsRoutes = require('./seo-panel/routes/misReportsRoutes');
const userSessionRoutes = require('./seo-panel/routes/userSessionRoutes');

const { startLeadRetentionSchedule } = require('./seo-panel/services/leadRetention');

const app = express();
const PORT = process.env.PORT || runtimeConfig.PORT;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || runtimeConfig.MONGO_URI;
let mongoConnectionPromise = null;
let leadRetentionStarted = false;

mongoose.set('strictQuery', true);
mongoose.connection.on('error', err => console.error('Mongo Error:', err));
mongoose.connection.on('disconnected', () => console.warn('MongoDB Disconnected'));

const parseOrigins = value =>
  (value || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

// Keep the production domains available even when Hostinger provides an
// ALLOWED_ORIGINS environment variable containing additional origins.
const configuredOrigins = [
  ...parseOrigins(runtimeConfig.ALLOWED_ORIGINS),
  ...parseOrigins(process.env.ALLOWED_ORIGINS),
];

const defaultDevOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const effectiveAllowedOrigins = new Set([...configuredOrigins, ...defaultDevOrigins]);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser tools (Postman/curl) and same-origin server calls.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/$/, '');

    if (effectiveAllowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    const error = new Error(`CORS blocked for origin: ${origin}`);
    error.status = 403;
    return callback(error);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Accept', 'Authorization', 'Content-Type', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

// This middleware answers browser OPTIONS preflight requests before database
// connection or route handlers are invoked.
app.use(cors(corsOptions));
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
      if (!leadRetentionStarted) {
        startLeadRetentionSchedule();
        leadRetentionStarted = true;
      }
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
app.use('/api/jobs', jobRoutes);
app.use('/api/job-applications', jobApplicationRoutes);
app.use('/api/panel-leads', leadRoutes);
app.use('/api/manpower-requisitions', manpowerRequisitionRoutes);
app.use('/api/candidate-master', candidateMasterRoutes);
app.use('/api/recruitment-pipeline', recruitmentPipelineRoutes);
app.use('/api/interview-tracker', interviewTrackerRoutes);
app.use('/api/offer-tracker', offerTrackerRoutes);
app.use('/api/joining-tracker', joiningTrackerRoutes);
app.use('/api/onboarding-checklist', onboardingChecklistRoutes);
app.use('/api/recruitment-follow-up', recruitmentFollowUpRoutes);
app.use('/api/performance-reports', performanceReportsRoutes);
app.use('/api/master-settings', masterSettingsRoutes);
app.use('/api/mis-reports', misReportsRoutes);
app.use('/api/user-sessions', userSessionRoutes);


app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(err.status || 500).json({
    ok: false,
    error: err.status === 403 ? err.message : 'Internal Server Error',
  });
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

if (require.main === module) {
  startServer();
}

module.exports = app;



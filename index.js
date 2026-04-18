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
const PORT = process.env.PORT;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
  })
);
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
  console.error('Unhandled error', err);
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database connection failed', error.message);
    process.exit(1);
  });


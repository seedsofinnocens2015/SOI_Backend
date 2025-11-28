require('dotenv').config();
const express = require('express');
const cors = require('cors');

const websiteBookingRoutes = require('./routes/websiteBookingPageRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

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

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/website-bookings', websiteBookingRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ ok: false, error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

const runtimeConfig = {
  PORT: '4000',
  MONGO_URI: 'mongodb://localhost:27017/seo_panel',
  ALLOWED_ORIGINS:
    'http://localhost:3000,https://www.seedsofinnocens.com,https://www.seedsofinnocence.com,https://soi.seedsofinnocens.com',
  RECEIVER_EMAIL: 'digital@seedsofinnocence.com',
  FEEDBACK_RECEIVER_EMAIL: 'feedback@seedsofinnocence.com',
  SEO_AUTH_JWT_SECRET: 'change-this-seo-secret',
  LSQ_BASE_URL: 'https://api-in21.leadsquared.com',
  LSQ_ACCESS_KEY: 'u$r328af19f4aab806b97755ad43e339579',
  LSQ_SECRET_KEY: 'c363ce0623e232e4a831e2557b6753c7ab438837',
  SMTP_HOST: 'mail.seedsofinnocence.com',
  SMTP_PORT: '587',
  SMTP_USER: 'digital@seedsofinnocence.com',
  SMTP_PASS: 'Newsoi@2026',
  SMTP_SECURE: 'false',
  SMTP_FROM: '"SOI Website" <digital@seedsofinnocence.com>',
  EMAIL_FROM: '"SOI Website" <digital@seedsofinnocence.com>',
};

module.exports = runtimeConfig;

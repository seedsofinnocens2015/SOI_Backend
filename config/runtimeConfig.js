const runtimeConfig = {
  PORT: '4000',
  MONGO_URI: 'mongodb://seo_panel:9315264682@ac-fv7uqzx-shard-00-00.wbfh1zj.mongodb.net:27017,ac-fv7uqzx-shard-00-01.wbfh1zj.mongodb.net:27017,ac-fv7uqzx-shard-00-02.wbfh1zj.mongodb.net:27017/?ssl=true&replicaSet=atlas-xlg8mn-shard-0&authSource=admin&appName=Cluster0',
  ALLOWED_ORIGINS:
    'http://localhost:3000,https://www.seedsofinnocens.com,https://www.seedsofinnocence.com,https://seeds.seedsofinnocens.com,https://soi-admin.seedsofinnocens.com,https://seeds.seedsofinnocens.com',
  RECEIVER_EMAIL: 'digital@seedsofinnocence.com',
  FEEDBACK_RECEIVER_EMAIL: 'feedback@seedsofinnocence.com',
  CAREERS_RECEIVER_EMAIL: 'career@seedsofinnocence.com',
  SURGICAL_RECEIVER_EMAIL: 'innocensseedsof@gmail.com',
  SEO_AUTH_JWT_SECRET: 'change-this-seo-secret',
  LSQ_BASE_URL: 'https://api-in21.leadsquared.com',
  LSQ_ACCESS_KEY: 'u$re4c970aee03a36630af47605bf4675fa',
  LSQ_SECRET_KEY: 'd251b5571a77243b8a6e92f33206d26c906c8754',
  SMTP_HOST: 'mail.seedsofinnocence.com',
  SURGICAL_SMTP_IP: '68.178.145.239',
  SMTP_PORT: '587',
  SMTP_USER: 'digital@seedsofinnocence.com',
  SMTP_PASS: 'Newsoi@2026',
  SMTP_SECURE: 'false',
  SMTP_FROM: '"SOI Website" <digital@seedsofinnocence.com>',
  EMAIL_FROM: '"SOI Website" <digital@seedsofinnocence.com>',
};

module.exports = runtimeConfig;

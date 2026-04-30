const jwt = require('jsonwebtoken');
const runtimeConfig = require('../../config/runtimeConfig');

function getJwtSecret() {
  return process.env.SEO_AUTH_JWT_SECRET || process.env.JWT_SECRET || runtimeConfig.SEO_AUTH_JWT_SECRET;
}

function protectSeoAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: token missing' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.seoUser = decoded;
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
  }
}

module.exports = {
  protectSeoAuth,
};

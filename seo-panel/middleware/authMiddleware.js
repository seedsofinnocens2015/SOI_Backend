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
    const role = decoded.role || 'seo';
    if (!['seo', 'admin'].includes(role)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: SEO access required' });
    }
    req.seoUser = { ...decoded, role };
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
  }
}

function protectHrAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: token missing' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const role = decoded.role || 'seo';
    if (!['hr', 'admin'].includes(role)) {
      return res.status(403).json({ ok: false, error: 'Forbidden: HR access required' });
    }
    req.seoUser = { ...decoded, role };
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
  }
}

function protectFullAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: token missing' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const email = String(decoded.email || '').trim().toLowerCase();
    if (decoded.role !== 'admin' || email !== 'amitkumaryadav8314@gmail.com') {
      return res.status(403).json({ ok: false, error: 'Forbidden: Full Admin access required' });
    }
    req.seoUser = { ...decoded, email, role: 'admin' };
    return next();
  } catch (_error) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: invalid token' });
  }
}

module.exports = {
  protectSeoAuth,
  protectHrAuth,
  protectFullAdmin,
};

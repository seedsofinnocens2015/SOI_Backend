const RedirectRule = require('../../models/seoPanel/RedirectRule');

const normalizeUrlPath = (url) => {
  if (!url) return '/';
  const clean = url.split('?')[0].split('#')[0].trim();
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
};

const redirectMiddleware = async (req, res, next) => {
  try {
    const requestPath = normalizeUrlPath(req.path);
    const rule = await RedirectRule.findOne({
      oldUrl: requestPath,
      isActive: true,
    }).lean();

    if (!rule) return next();
    return res.redirect(rule.statusCode, rule.newUrl);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  redirectMiddleware,
};

const seoService = require('../../services/seoPanel/seoPanelService');

const catchAsync = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

const createCrudHandlers = (service) => ({
  list: catchAsync(async (_req, res) => {
    const data = await service.list();
    res.json({ ok: true, data });
  }),
  getById: catchAsync(async (req, res) => {
    const data = await service.getById(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, data });
  }),
  create: catchAsync(async (req, res) => {
    const data = await service.create(req.body);
    res.status(201).json({ ok: true, data });
  }),
  update: catchAsync(async (req, res) => {
    const data = await service.update(req.params.id, req.body);
    if (!data) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, data });
  }),
  remove: catchAsync(async (req, res) => {
    const data = await service.remove(req.params.id);
    if (!data) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, data });
  }),
});

const pageSeo = createCrudHandlers(seoService.pageSeo);
const robotsRule = createCrudHandlers(seoService.robotsRule);
const schemaMarkup = createCrudHandlers(seoService.schemaMarkup);
const localSeo = createCrudHandlers(seoService.localSeo);
const blogSeo = createCrudHandlers(seoService.blogSeo);
const redirectRule = createCrudHandlers(seoService.redirectRule);
const globalSeoSetting = createCrudHandlers(seoService.globalSeoSetting);
const sitemapConfig = createCrudHandlers(seoService.sitemapConfig);

const getSeoIssues = catchAsync(async (_req, res) => {
  const data = await seoService.getSeoIssues();
  res.json({ ok: true, data });
});

const getSitemapXml = catchAsync(async (_req, res) => {
  const xml = await seoService.getSitemapXml();
  res.type('application/xml').send(xml);
});

const getRobotsTxt = catchAsync(async (_req, res) => {
  const text = await seoService.getRobotsTxt();
  res.type('text/plain').send(text);
});

const getResolvedSeo = catchAsync(async (_req, res) => {
  res.json({ ok: true, data: res.locals.seo || null });
});

module.exports = {
  pageSeo,
  robotsRule,
  schemaMarkup,
  localSeo,
  blogSeo,
  redirectRule,
  globalSeoSetting,
  sitemapConfig,
  getSeoIssues,
  getSitemapXml,
  getRobotsTxt,
  getResolvedSeo,
};

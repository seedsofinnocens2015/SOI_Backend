const PageSeo = require('../../models/seoPanel/PageSeo');
const RobotsRule = require('../../models/seoPanel/RobotsRule');
const SchemaMarkup = require('../../models/seoPanel/SchemaMarkup');
const LocalSeoPage = require('../../models/seoPanel/LocalSeoPage');
const BlogSeo = require('../../models/seoPanel/BlogSeo');
const RedirectRule = require('../../models/seoPanel/RedirectRule');
const GlobalSeoSetting = require('../../models/seoPanel/GlobalSeoSetting');
const SitemapConfig = require('../../models/seoPanel/SitemapConfig');

const list = (Model) => Model.find().sort({ updatedAt: -1 }).lean();
const getById = (Model, id) => Model.findById(id).lean();
const create = (Model, payload) => Model.create(payload);
const update = (Model, id, payload) => Model.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
const remove = (Model, id) => Model.findByIdAndDelete(id).lean();

const getSeoIssues = async () => {
  const pages = await PageSeo.find().lean();
  const titleMap = new Map();

  pages.forEach((page) => {
    const key = (page.title || '').toLowerCase().trim();
    if (!key) return;
    titleMap.set(key, [...(titleMap.get(key) || []), page.pageUrl]);
  });

  const duplicateTitles = [...titleMap.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls }));

  return {
    missingTitle: pages.filter(page => !page.title?.trim()).map(page => page.pageUrl),
    missingDescription: pages.filter(page => !page.description?.trim()).map(page => page.pageUrl),
    duplicateTitles,
    scannedCount: pages.length,
  };
};

const getSitemapXml = async () => {
  const [pages, config] = await Promise.all([
    PageSeo.find({
      ...(process.env.SITEMAP_INCLUDE_NOINDEX === 'true' ? {} : { robots: 'index', 'sitemap.isIndexed': true }),
    }).lean(),
    SitemapConfig.findOne().sort({ updatedAt: -1 }).lean(),
  ]);

  const siteUrl = config?.siteUrl || process.env.SEO_SITE_URL || '';
  if (!siteUrl) {
    throw new Error('SEO_SITE_URL or sitemap config siteUrl is required for sitemap generation');
  }

  const normalize = (u) => `${siteUrl.replace(/\/$/, '')}/${u.replace(/^\//, '')}`;

  const urlsXml = pages
    .map(page => {
      const loc = normalize(page.pageUrl);
      const lastmod = (page.sitemap?.lastmod || page.updatedAt || new Date()).toISOString();
      const priority = page.sitemap?.priority ?? config?.defaultPriority ?? 0.7;
      const changefreq = page.sitemap?.changefreq || config?.defaultChangefreq || 'weekly';
      return `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlsXml}</urlset>`;
};

const getRobotsTxt = async () => {
  const rules = await RobotsRule.find({ isActive: true }).sort({ updatedAt: -1 }).lean();
  if (!rules.length) return 'User-agent: *\nAllow: /\n';

  return rules
    .map((rule) => {
      const lines = [`User-agent: ${rule.userAgent || '*'}`];
      (rule.allow || []).forEach(path => lines.push(`Allow: ${path}`));
      (rule.disallow || []).forEach(path => lines.push(`Disallow: ${path}`));
      if (rule.host) lines.push(`Host: ${rule.host}`);
      if (rule.sitemapUrl) lines.push(`Sitemap: ${rule.sitemapUrl}`);
      (rule.customDirectives || []).forEach(d => lines.push(d));
      return lines.join('\n');
    })
    .join('\n\n');
};

module.exports = {
  pageSeo: {
    list: () => list(PageSeo),
    getById: (id) => getById(PageSeo, id),
    create: (payload) => create(PageSeo, payload),
    update: (id, payload) => update(PageSeo, id, payload),
    remove: (id) => remove(PageSeo, id),
  },
  robotsRule: {
    list: () => list(RobotsRule),
    getById: (id) => getById(RobotsRule, id),
    create: (payload) => create(RobotsRule, payload),
    update: (id, payload) => update(RobotsRule, id, payload),
    remove: (id) => remove(RobotsRule, id),
  },
  schemaMarkup: {
    list: () => list(SchemaMarkup),
    getById: (id) => getById(SchemaMarkup, id),
    create: (payload) => create(SchemaMarkup, payload),
    update: (id, payload) => update(SchemaMarkup, id, payload),
    remove: (id) => remove(SchemaMarkup, id),
  },
  localSeo: {
    list: () => list(LocalSeoPage),
    getById: (id) => getById(LocalSeoPage, id),
    create: (payload) => create(LocalSeoPage, payload),
    update: (id, payload) => update(LocalSeoPage, id, payload),
    remove: (id) => remove(LocalSeoPage, id),
  },
  blogSeo: {
    list: () => list(BlogSeo),
    getById: (id) => getById(BlogSeo, id),
    create: (payload) => create(BlogSeo, payload),
    update: (id, payload) => update(BlogSeo, id, payload),
    remove: (id) => remove(BlogSeo, id),
  },
  redirectRule: {
    list: () => list(RedirectRule),
    getById: (id) => getById(RedirectRule, id),
    create: (payload) => create(RedirectRule, payload),
    update: (id, payload) => update(RedirectRule, id, payload),
    remove: (id) => remove(RedirectRule, id),
  },
  globalSeoSetting: {
    list: () => list(GlobalSeoSetting),
    getById: (id) => getById(GlobalSeoSetting, id),
    create: (payload) => create(GlobalSeoSetting, payload),
    update: (id, payload) => update(GlobalSeoSetting, id, payload),
    remove: (id) => remove(GlobalSeoSetting, id),
  },
  sitemapConfig: {
    list: () => list(SitemapConfig),
    getById: (id) => getById(SitemapConfig, id),
    create: (payload) => create(SitemapConfig, payload),
    update: (id, payload) => update(SitemapConfig, id, payload),
    remove: (id) => remove(SitemapConfig, id),
  },
  getSeoIssues,
  getSitemapXml,
  getRobotsTxt,
};

const PageSeo = require('../../models/seoPanel/PageSeo');
const GlobalSeoSetting = require('../../models/seoPanel/GlobalSeoSetting');
const SchemaMarkup = require('../../models/seoPanel/SchemaMarkup');

const seoInjectionMiddleware = async (req, res, next) => {
  try {
    const pageUrl = req.query.pageUrl || req.path;

    const [pageSeo, globalSettings, schemaMarkup] = await Promise.all([
      PageSeo.findOne({ pageUrl }).lean(),
      GlobalSeoSetting.findOne().sort({ updatedAt: -1 }).lean(),
      SchemaMarkup.findOne({ pageUrl, isActive: true }).lean(),
    ]);

    res.locals.seo = {
      title: pageSeo?.title || globalSettings?.defaultMetaTitle || '',
      description: pageSeo?.description || globalSettings?.defaultMetaDescription || '',
      keywords: pageSeo?.keywords || [],
      canonicalUrl: pageSeo?.canonicalUrl || '',
      robots: pageSeo?.robots || 'index',
      ogTitle: pageSeo?.ogTitle || pageSeo?.title || globalSettings?.defaultMetaTitle || '',
      ogDescription:
        pageSeo?.ogDescription || pageSeo?.description || globalSettings?.defaultMetaDescription || '',
      ogImage: pageSeo?.ogImage || globalSettings?.defaultOgImage || '',
      schema: schemaMarkup?.jsonLd || null,
      siteName: globalSettings?.siteName || '',
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  seoInjectionMiddleware,
};

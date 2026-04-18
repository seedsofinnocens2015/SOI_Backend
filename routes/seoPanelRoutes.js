const express = require('express');
const controller = require('../controller/seoPanel/seoPanelController');
const { validateRequest } = require('../middleware/seoPanel/validateRequest');
const { seoInjectionMiddleware } = require('../middleware/seoPanel/seoInjectionMiddleware');
const {
  pageSeoSchema,
  robotsRuleSchema,
  schemaMarkupSchema,
  localSeoSchema,
  blogSeoSchema,
  redirectSchema,
  globalSeoSchema,
  sitemapConfigSchema,
} = require('../validation/seoPanelSchemas');

const router = express.Router();

const crudRoutes = (path, handlers, schema) => {
  router.get(path, handlers.list);
  router.get(`${path}/:id`, handlers.getById);
  router.post(path, validateRequest(schema), handlers.create);
  router.put(`${path}/:id`, validateRequest(schema.partial()), handlers.update);
  router.delete(`${path}/:id`, handlers.remove);
};

crudRoutes('/page-seo', controller.pageSeo, pageSeoSchema);
crudRoutes('/robots-rules', controller.robotsRule, robotsRuleSchema);
crudRoutes('/schema-markup', controller.schemaMarkup, schemaMarkupSchema);
crudRoutes('/local-seo', controller.localSeo, localSeoSchema);
crudRoutes('/blog-seo', controller.blogSeo, blogSeoSchema);
crudRoutes('/redirect-rules', controller.redirectRule, redirectSchema);
crudRoutes('/global-settings', controller.globalSeoSetting, globalSeoSchema);
crudRoutes('/sitemap-config', controller.sitemapConfig, sitemapConfigSchema);

router.get('/analytics/issues', controller.getSeoIssues);
router.get('/resolve', seoInjectionMiddleware, controller.getResolvedSeo);

module.exports = router;

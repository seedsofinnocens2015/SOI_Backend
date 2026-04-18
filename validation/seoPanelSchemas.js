const { z } = require('zod');

const robotsEnum = z.enum(['index', 'noindex']);
const changefreqEnum = z.enum(['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never']);

const pageSeoSchema = z.object({
  pageUrl: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).optional().default([]),
  canonicalUrl: z.string().optional(),
  robots: robotsEnum.optional().default('index'),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  sitemap: z
    .object({
      priority: z.number().min(0).max(1).optional(),
      changefreq: changefreqEnum.optional(),
      isIndexed: z.boolean().optional(),
      lastmod: z.string().optional(),
    })
    .optional(),
});

const robotsRuleSchema = z.object({
  userAgent: z.string().optional().default('*'),
  allow: z.array(z.string()).optional().default([]),
  disallow: z.array(z.string()).optional().default([]),
  sitemapUrl: z.string().optional(),
  host: z.string().optional(),
  customDirectives: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const schemaMarkupSchema = z.object({
  pageUrl: z.string().min(1),
  schemaType: z.enum(['MedicalClinic', 'Doctor', 'FAQ']),
  jsonLd: z.record(z.any()),
  isActive: z.boolean().optional().default(true),
});

const localSeoSchema = z.object({
  city: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  mapLink: z.string().min(1),
  pageTitle: z.string().optional(),
  pageDescription: z.string().optional(),
  keywords: z.array(z.string()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

const blogSeoSchema = z.object({
  slug: z.string().min(1),
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  canonicalUrl: z.string().optional(),
  robots: robotsEnum.optional().default('index'),
});

const redirectSchema = z.object({
  oldUrl: z.string().min(1),
  newUrl: z.string().min(1),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional().default(301),
  isActive: z.boolean().optional().default(true),
});

const globalSeoSchema = z.object({
  defaultMetaTitle: z.string().min(1),
  defaultMetaDescription: z.string().min(1),
  defaultOgImage: z.string().optional(),
  siteName: z.string().min(1),
  googleVerificationCode: z.string().optional(),
  metaPixelScript: z.string().optional(),
  analyticsScript: z.string().optional(),
});

const sitemapConfigSchema = z.object({
  siteUrl: z.string().min(1),
  defaultPriority: z.number().min(0).max(1).optional(),
  defaultChangefreq: changefreqEnum.optional(),
  includeNoindex: z.boolean().optional(),
});

module.exports = {
  pageSeoSchema,
  robotsRuleSchema,
  schemaMarkupSchema,
  localSeoSchema,
  blogSeoSchema,
  redirectSchema,
  globalSeoSchema,
  sitemapConfigSchema,
};

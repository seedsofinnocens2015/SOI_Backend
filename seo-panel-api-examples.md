# SEO Panel API Examples

Base URL: `http://localhost:3000`

## 1) Create Page SEO
```bash
curl -X POST http://localhost:3000/api/seo-panel/page-seo \
  -H "Content-Type: application/json" \
  -d '{
    "pageUrl": "/ivf-treatment",
    "title": "Best IVF Treatment in India | Seeds of Innocence",
    "description": "Advanced IVF treatment with high success rates.",
    "keywords": ["ivf", "fertility", "ivf india"],
    "canonicalUrl": "https://www.seedsofinnocence.com/ivf-treatment",
    "robots": "index",
    "ogTitle": "IVF Treatment - Seeds of Innocence",
    "ogDescription": "Explore world-class IVF treatment options.",
    "ogImage": "https://www.seedsofinnocence.com/seo/ivf-og.jpg",
    "sitemap": {
      "priority": 0.9,
      "changefreq": "weekly",
      "isIndexed": true
    }
  }'
```

## 2) Create Schema Markup
```bash
curl -X POST http://localhost:3000/api/seo-panel/schema-markup \
  -H "Content-Type: application/json" \
  -d '{
    "pageUrl": "/ivf-treatment",
    "schemaType": "MedicalClinic",
    "jsonLd": {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      "name": "Seeds of Innocence",
      "url": "https://www.seedsofinnocence.com"
    }
  }'
```

## 3) Create Redirect Rule
```bash
curl -X POST http://localhost:3000/api/seo-panel/redirect-rules \
  -H "Content-Type: application/json" \
  -d '{
    "oldUrl": "/old-ivf-page",
    "newUrl": "/ivf-treatment",
    "statusCode": 301
  }'
```

## 4) SEO Analytics Issues
```bash
curl http://localhost:3000/api/seo-panel/analytics/issues
```

## 5) Dynamic Sitemap and Robots
```bash
curl http://localhost:3000/sitemap.xml
curl http://localhost:3000/robots.txt
```

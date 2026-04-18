const mongoose = require('mongoose');

const pageSeoSchema = new mongoose.Schema(
  {
    pageUrl: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    keywords: [{ type: String, trim: true }],
    canonicalUrl: { type: String, trim: true },
    robots: { type: String, enum: ['index', 'noindex'], default: 'index' },
    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    sitemap: {
      priority: { type: Number, default: 0.7, min: 0, max: 1 },
      changefreq: {
        type: String,
        enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
        default: 'weekly',
      },
      isIndexed: { type: Boolean, default: true },
      lastmod: { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PageSeo', pageSeoSchema);

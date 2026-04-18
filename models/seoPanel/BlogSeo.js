const mongoose = require('mongoose');

const blogSeoSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    metaTitle: { type: String, required: true, trim: true },
    metaDescription: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true }],
    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    robots: { type: String, enum: ['index', 'noindex'], default: 'index' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogSeo', blogSeoSchema);

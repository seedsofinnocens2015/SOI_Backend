const mongoose = require('mongoose');

const sitemapConfigSchema = new mongoose.Schema(
  {
    siteUrl: { type: String, required: true, trim: true },
    defaultPriority: { type: Number, default: 0.7, min: 0, max: 1 },
    defaultChangefreq: {
      type: String,
      enum: ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'],
      default: 'weekly',
    },
    includeNoindex: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SitemapConfig', sitemapConfigSchema);

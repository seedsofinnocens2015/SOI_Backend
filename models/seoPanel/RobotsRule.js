const mongoose = require('mongoose');

const robotsRuleSchema = new mongoose.Schema(
  {
    userAgent: { type: String, default: '*', trim: true },
    allow: [{ type: String, trim: true }],
    disallow: [{ type: String, trim: true }],
    sitemapUrl: { type: String, trim: true },
    host: { type: String, trim: true },
    customDirectives: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RobotsRule', robotsRuleSchema);

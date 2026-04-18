const mongoose = require('mongoose');

const globalSeoSettingSchema = new mongoose.Schema(
  {
    defaultMetaTitle: { type: String, required: true, trim: true },
    defaultMetaDescription: { type: String, required: true, trim: true },
    defaultOgImage: { type: String, trim: true },
    siteName: { type: String, required: true, trim: true },
    googleVerificationCode: { type: String, trim: true },
    metaPixelScript: { type: String, trim: true },
    analyticsScript: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GlobalSeoSetting', globalSeoSettingSchema);

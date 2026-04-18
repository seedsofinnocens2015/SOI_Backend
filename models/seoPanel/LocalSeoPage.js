const mongoose = require('mongoose');

const localSeoPageSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    mapLink: { type: String, required: true, trim: true },
    pageTitle: { type: String, trim: true },
    pageDescription: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LocalSeoPage', localSeoPageSchema);

const mongoose = require('mongoose');

const { Schema } = mongoose;

const seoSchema = new Schema(
  {
    pageUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pageTitle: { type: String, trim: true, default: '' },
    metaKeyword: { type: String, trim: true, default: '' },
    metaDescription: { type: String, trim: true, default: '' },
    newsKeywords: { type: String, trim: true, default: '' },
    abstract: { type: String, trim: true, default: '' },
    dcSource: { type: String, trim: true, default: '' },
    dcTitle: { type: String, trim: true, default: '' },
    dcKeywords: { type: String, trim: true, default: '' },
    dcDescription: { type: String, trim: true, default: '' },
    canonical: { type: String, trim: true, default: '' },
    alternate: { type: String, trim: true, default: '' },
    robot: { type: String, trim: true, default: '' },
    copyright: { type: String, trim: true, default: '' },
    author: { type: String, trim: true, default: '' },
    ogLocale: { type: String, trim: true, default: '' },
    ogType: { type: String, trim: true, default: '' },
    ogTitle: { type: String, trim: true, default: '' },
    ogDescription: { type: String, trim: true, default: '' },
    ogUrl: { type: String, trim: true, default: '' },
    ogSiteName: { type: String, trim: true, default: '' },
    ogImage: { type: String, trim: true, default: '' },
    fbAdmins: { type: String, trim: true, default: '' },
    twitterCard: { type: String, trim: true, default: '' },
    twitterSite: { type: String, trim: true, default: '' },
    twitterCreator: { type: String, trim: true, default: '' },
    twitterTitle: { type: String, trim: true, default: '' },
    twitterDescription: { type: String, trim: true, default: '' },
    twitterImageSrc: { type: String, trim: true, default: '' },
    twitterCanonical: { type: String, trim: true, default: '' },
    itemType: { type: String, trim: true, default: '' },
    itemName: { type: String, trim: true, default: '' },
    itemDescription: { type: String, trim: true, default: '' },
    itemUrl: { type: String, trim: true, default: '' },
    itemImage: { type: String, trim: true, default: '' },
    itemAuthor: { type: String, trim: true, default: '' },
    itemOrganization: { type: String, trim: true, default: '' },
    hierarchyPath: { type: [String], default: [] },
  },
  { timestamps: true }
);

seoSchema.index({ pageUrl: 1 }, { unique: true });

function sanitizeCollectionSegment(segment = '') {
  return String(segment)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function buildCollectionName(hierarchyPath = []) {
  const segments = Array.isArray(hierarchyPath)
    ? hierarchyPath.map(sanitizeCollectionSegment).filter(Boolean)
    : [];

  if (!segments.length) {
    return 'seo_default';
  }

  return `seo_${segments.join('__')}`;
}

function getSeoModel(hierarchyPath = []) {
  const collectionName = buildCollectionName(hierarchyPath);
  const modelName = `Seo_${collectionName}`;

  if (mongoose.models[modelName]) {
    return mongoose.models[modelName];
  }

  return mongoose.model(modelName, seoSchema, collectionName);
}

module.exports = {
  getSeoModel,
  buildCollectionName,
};

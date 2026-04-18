const mongoose = require('mongoose');

const schemaMarkupSchema = new mongoose.Schema(
  {
    pageUrl: { type: String, required: true, unique: true, trim: true },
    schemaType: {
      type: String,
      enum: ['MedicalClinic', 'Doctor', 'FAQ'],
      required: true,
    },
    jsonLd: { type: mongoose.Schema.Types.Mixed, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SchemaMarkup', schemaMarkupSchema);

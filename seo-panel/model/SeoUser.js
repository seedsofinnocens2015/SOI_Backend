const mongoose = require('mongoose');

const { Schema } = mongoose;

const seoUserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['seo', 'hr', 'admin'],
      default: 'seo',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SeoUser || mongoose.model('SeoUser', seoUserSchema, 'seo_users');

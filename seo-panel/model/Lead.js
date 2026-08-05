const mongoose = require('mongoose');

const { Schema } = mongoose;

const leadSchema = new Schema(
  {
    leadType: {
      type: String,
      enum: ['website', 'landing-page'],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    center: { type: String, trim: true, maxlength: 240 },
    message: { type: String, trim: true, maxlength: 4000 },
    source: { type: String, trim: true, maxlength: 500 },
    utm_source: { type: String, trim: true, maxlength: 500 },
    utm_medium: { type: String, trim: true, maxlength: 500 },
    utm_campaign: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

leadSchema.index({ leadType: 1, createdAt: -1 });

module.exports = mongoose.models.PanelLead || mongoose.model('PanelLead', leadSchema, 'panel_leads');

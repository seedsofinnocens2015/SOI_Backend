const mongoose = require('mongoose');

const redirectRuleSchema = new mongoose.Schema(
  {
    oldUrl: { type: String, required: true, unique: true, trim: true },
    newUrl: { type: String, required: true, trim: true },
    statusCode: { type: Number, enum: [301, 302], default: 301 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('RedirectRule', redirectRuleSchema);

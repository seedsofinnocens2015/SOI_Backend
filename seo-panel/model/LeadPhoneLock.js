const mongoose = require('mongoose');

const { Schema } = mongoose;

const leadPhoneLockSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    formType: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.LeadPhoneLock ||
  mongoose.model('LeadPhoneLock', leadPhoneLockSchema, 'lead_phone_locks');

const mongoose = require('mongoose');

const { Schema } = mongoose;

const seoAuthOtpSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, required: true, enum: ['signup', 'login'] },
    otpCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attemptsLeft: { type: Number, default: 5 },
    pendingSignupName: { type: String, default: '' },
    pendingSignupPassword: { type: String, default: '' },
    pendingLoginUserId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

seoAuthOtpSchema.index({ email: 1, purpose: 1 }, { unique: true });
seoAuthOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.SeoAuthOtp || mongoose.model('SeoAuthOtp', seoAuthOtpSchema, 'seo_auth_otps');

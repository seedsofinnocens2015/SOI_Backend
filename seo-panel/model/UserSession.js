const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'SeoUser',
      index: true,
    },
    loginId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    userName: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      trim: true,
      default: 'hr',
    },
    loginTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    lastActiveTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Timed Out'],
      default: 'Active',
      index: true,
    },
  },
  { timestamps: true }
);

const UserSession =
  mongoose.models.UserSession ||
  mongoose.model('UserSession', userSessionSchema, 'user_sessions');

module.exports = {
  UserSession,
};

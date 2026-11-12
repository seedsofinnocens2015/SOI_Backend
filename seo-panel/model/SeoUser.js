const mongoose = require('mongoose');

const { Schema } = mongoose;

const seoUserSchema = new Schema(
  {
    loginId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      lowercase: true,
    },
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
      default: 'hr',
      required: true,
    },
    userType: {
      type: String,
      default: 'Team Member',
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    canManageTeam: {
      type: Boolean,
      default: false,
    },
    isAdministrator: {
      type: Boolean,
      default: false,
    },
    recruiter: {
      type: String,
      trim: true,
      default: '',
    },
    workVisibility: {
      type: Boolean,
      default: false, // Show only requisitions and candidates assigned to this recruiter
    },
    // Schema.Types.Mixed allows storing granular permissions for all sidebar items dynamically
    permissions: {
      type: Schema.Types.Mixed,
      default: () => ({
        dashboard: 'full',
        requisitions: 'full',
        'candidate-master': 'full',
        pipeline: 'full',
        interviews: 'full',
        offers: 'full',
        joinings: 'full',
        onboarding: 'full',
        'users-access': 'full',
        openings: 'full',
        applications: 'full',
      }),
    },
    addedBy: {
      type: String,
      default: 'System',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SeoUser || mongoose.model('SeoUser', seoUserSchema, 'seo_users');

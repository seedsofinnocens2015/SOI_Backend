const mongoose = require('mongoose');

const { Schema } = mongoose;

const companyLetterheadSchema = new Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    gstNo: {
      type: String,
      trim: true,
      default: '',
    },
    pan: {
      type: String,
      trim: true,
      default: '',
    },
    cin: {
      type: String,
      trim: true,
      default: '',
    },
    registeredAddress: {
      type: String,
      trim: true,
      default: '',
    },
    letterheadImage: {
      type: String, // url or base64 or path
      default: '',
    },
    margins: {
      top: { type: Number, default: 45 },
      bottom: { type: Number, default: 25 },
      left: { type: Number, default: 20 },
      right: { type: Number, default: 20 },
    },
    active: {
      type: Boolean,
      default: true,
    },
    signatories: [
      {
        name: { type: String, trim: true, default: '' },
        designation: { type: String, trim: true, default: '' },
        signatureImage: { type: String, default: '' },
        isDefault: { type: Boolean, default: false },
        active: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

const masterSettingsSchema = new Schema(
  {
    // Key-value for dropdowns, e.g. dropdowns: { 'centres': [{ value: 'Delhi', extra: '' }] }
    dropdowns: {
      type: Map,
      of: [
        {
          value: { type: String, trim: true },
          extra: { type: String, trim: true, default: '' },
        },
      ],
      default: {},
    },
    // Letter templates
    offerLetterTemplate: {
      type: String,
      default: '',
    },
    appointmentLetterTemplate: {
      type: String,
      default: '',
    },
    // General Settings
    probationMonths: {
      type: Number,
      default: 6,
    },
    vacancyClosureDays: {
      type: Number,
      default: 30,
    },
    autoLogoutMinutes: {
      type: Number,
      default: 30,
    },
    requisitionIdPrefix: {
      type: String,
      trim: true,
      default: 'REQ-',
    },
    candidateIdPrefix: {
      type: String,
      trim: true,
      default: 'CAN-',
    },
  },
  { timestamps: true }
);

const HrMasterSetting = mongoose.models.HrMasterSetting || mongoose.model('HrMasterSetting', masterSettingsSchema, 'hr_master_settings');
const HrCompany = mongoose.models.HrCompany || mongoose.model('HrCompany', companyLetterheadSchema, 'hr_companies');

module.exports = {
  HrMasterSetting,
  HrCompany,
};

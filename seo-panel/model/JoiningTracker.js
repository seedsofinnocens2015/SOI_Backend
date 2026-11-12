const mongoose = require('mongoose');

const { Schema } = mongoose;

const JOINING_STATUSES = [
  'Pending Joining',
  'Joined',
  'No Show',
  'Offer Backed Out',
  'Deferred',
];

const joiningTrackerSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'CandidateMaster',
      required: true,
      index: true,
    },
    candidateIdStr: { type: String, trim: true, default: '' }, // e.g. CAN-0001
    candidateName: { type: String, required: true, trim: true },
    company: { type: String, trim: true, default: 'Seeds of Innocence' },
    centre: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    recruiter: { type: String, trim: true, default: '' },
    expectedDoj: { type: Date, default: null }, // Auto from OfferTracker
    actualDoj: { type: Date, default: null },
    joiningStatus: {
      type: String,
      enum: JOINING_STATUSES,
      default: 'Pending Joining',
      index: true,
    },
    employeeId: { type: String, trim: true, default: '' },
    reportingManager: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports = {
  JoiningTracker:
    mongoose.models.JoiningTracker ||
    mongoose.model('JoiningTracker', joiningTrackerSchema, 'hr_joining_tracker'),
  JOINING_STATUSES,
};

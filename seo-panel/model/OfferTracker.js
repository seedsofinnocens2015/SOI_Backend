const mongoose = require('mongoose');

const { Schema } = mongoose;

const OFFER_APPROVAL_STATUSES = ['Pending', 'Approved', 'Rejected', 'On Hold'];
const OFFER_STATUSES = [
  'Draft',
  'Offer Released',
  'Accepted',
  'Declined',
  'Joined',
  'Revoked',
];

const offerTrackerSchema = new Schema(
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
    expectedCtcLakh: { type: String, trim: true, default: '' },
    offeredCtcLakh: { type: String, trim: true, default: '' },
    offerRequestDate: { type: Date, default: Date.now },
    approvalStatus: {
      type: String,
      enum: OFFER_APPROVAL_STATUSES,
      default: 'Pending',
      index: true,
    },
    approvalDate: { type: Date, default: null },
    offerReleaseDate: { type: Date, default: null },
    offerStatus: {
      type: String,
      enum: OFFER_STATUSES,
      default: 'Offer Released',
      index: true,
    },
    responseDate: { type: Date, default: null },
    expectedDoj: { type: Date, default: null },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports = {
  OfferTracker:
    mongoose.models.OfferTracker ||
    mongoose.model('OfferTracker', offerTrackerSchema, 'hr_offer_tracker'),
  OFFER_APPROVAL_STATUSES,
  OFFER_STATUSES,
};

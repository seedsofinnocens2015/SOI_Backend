const mongoose = require('mongoose');

const { Schema } = mongoose;

const recruitmentFollowUpSchema = new Schema(
  {
    followUpDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: 'CandidateMaster',
      required: true,
      index: true,
    },
    candidateCode: {
      type: String,
      trim: true,
      default: '',
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
      default: 'Seeds of Innocence',
    },
    centre: {
      type: String,
      trim: true,
      default: '',
    },
    recruiter: {
      type: String,
      trim: true,
      default: '',
    },
    mode: {
      type: String,
      enum: ['Call', 'Email', 'WhatsApp', 'In-Person', 'Other', ''],
      default: 'Call',
    },
    discussionOutcome: {
      type: String,
      trim: true,
      default: '',
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
    },
    followUpStatus: {
      type: String,
      enum: ['Open', 'Completed', 'Cancelled', 'Closed', ''],
      default: 'Open',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = {
  RecruitmentFollowUp:
    mongoose.models.RecruitmentFollowUp ||
    mongoose.model('RecruitmentFollowUp', recruitmentFollowUpSchema, 'hr_recruitment_follow_ups'),
};

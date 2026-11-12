const mongoose = require('mongoose');

const { Schema } = mongoose;

const INTERVIEW_ROUNDS = [
  'Screening Call',
  'Round 1 - HR',
  'Round 2 - Department',
  'Round 3 - Final / Management',
  'Assignment / Test',
];

const INTERVIEW_MODES = ['Online / Video', 'In-Person / F2F', 'Telephonic'];
const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'No Show'];
const INTERVIEW_RESULTS = ['Pending', 'Selected / Cleared', 'Rejected', 'Hold'];

const interviewTrackerSchema = new Schema(
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
    stage: { type: String, trim: true, default: 'Screening' },
    interviewRound: {
      type: String,
      enum: INTERVIEW_ROUNDS,
      required: true,
      index: true,
    },
    interviewer: { type: String, trim: true, default: '' },
    interviewDate: { type: Date, required: true, default: Date.now },
    time: { type: String, trim: true, default: '' }, // e.g. 11:30 AM
    mode: {
      type: String,
      enum: ['Online / Video', 'In-Person / F2F', 'Telephonic', ''],
      default: 'Online / Video',
    },
    interviewStatus: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: 'Scheduled',
      index: true,
    },
    result: {
      type: String,
      enum: INTERVIEW_RESULTS,
      default: 'Pending',
      index: true,
    },
    rating: { type: String, trim: true, default: '' }, // 1-5
    feedback: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports = {
  InterviewTracker:
    mongoose.models.InterviewTracker ||
    mongoose.model('InterviewTracker', interviewTrackerSchema, 'hr_interview_tracker'),
  INTERVIEW_ROUNDS,
  INTERVIEW_MODES,
  INTERVIEW_STATUSES,
  INTERVIEW_RESULTS,
};

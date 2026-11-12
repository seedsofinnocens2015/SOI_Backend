const mongoose = require('mongoose');

const { Schema } = mongoose;

const candidateMasterSchema = new Schema(
  {
    candidateId: { type: String, unique: true, index: true }, // e.g. CAN-0001
    company: { type: String, required: true, default: 'Seeds of Innocence', trim: true },
    dateAdded: { type: Date, required: true, default: Date.now },
    candidateName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, default: '' },
    requisitionId: { type: Schema.Types.ObjectId, ref: 'ManpowerRequisition', default: null },
    reqIdStr: { type: String, trim: true, default: '' }, // e.g. REQ-0001
    source: {
      type: String,
      enum: ['Portal', 'LinkedIn', 'Referral', 'Direct', 'Consultancy', 'Naukri', 'Indeed', 'Internal', 'Other', ''],
      default: 'Direct',
    },
    recruiter: { type: String, trim: true, default: '' },
    centre: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    totalExpYrs: { type: String, trim: true, default: '' },
    currentCtcLakh: { type: String, trim: true, default: '' },
    expectedCtcLakh: { type: String, trim: true, default: '' },
    noticePeriodDays: { type: String, trim: true, default: '' },
    currentLocation: { type: String, trim: true, default: '' },
    roundsDone: { type: Number, default: 0 },
    currentStage: {
      type: String,
      enum: ['Sourced', 'Screening', 'L1 Interview', 'L2 Interview', 'HR Round', 'Offer Stage', 'Joined', 'Rejected', 'On Hold'],
      default: 'Sourced',
    },
    pipelineStatus: {
      type: String,
      enum: ['Active', 'Selected', 'Offer Released', 'Joined', 'Drop/Declined', 'Rejected'],
      default: 'Active',
    },
    remarks: { type: String, trim: true, default: '' },
    resume: {
      originalName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      size: { type: Number, default: 0 },
      data: { type: Buffer, select: false },
      cloudinaryPublicId: { type: String, select: false },
      cloudinaryAssetId: { type: String, select: false },
      cloudinaryVersion: { type: Number, select: false },
      cloudinaryResourceType: { type: String, select: false },
      cloudinaryDeliveryType: { type: String, select: false },
    },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// Auto-increment candidateId CAN-0001
candidateMasterSchema.pre('validate', async function (next) {
  if (this.candidateId) return next();
  try {
    const lastDoc = await this.constructor.findOne({}, { candidateId: 1 }).sort({ createdAt: -1 }).lean();
    let nextNum = 1;
    if (lastDoc && lastDoc.candidateId) {
      const match = lastDoc.candidateId.match(/CAN-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    this.candidateId = `CAN-${String(nextNum).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = {
  CandidateMaster:
    mongoose.models.CandidateMaster ||
    mongoose.model('CandidateMaster', candidateMasterSchema, 'hr_candidate_master'),
};

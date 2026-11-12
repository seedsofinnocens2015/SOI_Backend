const mongoose = require('mongoose');

const { Schema } = mongoose;

const PIPELINE_STAGES = [
  'Sourced',
  'Screening',
  'L1 Interview',
  'L2 Interview',
  'HR Round',
  'Offer Stage',
  'Joined',
  'Rejected',
  'On Hold',
];

const STAGE_STATUS_MAP = {
  Sourced: 'Active',
  Screening: 'Active',
  'L1 Interview': 'Active',
  'L2 Interview': 'Active',
  'HR Round': 'Active',
  'Offer Stage': 'Offer Released',
  Joined: 'Joined',
  Rejected: 'Rejected',
  'On Hold': 'On Hold',
};

const recruitmentPipelineSchema = new Schema(
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
    source: { type: String, trim: true, default: '' },
    currentStage: {
      type: String,
      enum: PIPELINE_STAGES,
      default: 'Sourced',
      required: true,
      index: true,
    },
    stageDate: { type: Date, default: Date.now },
    pipelineStatus: {
      type: String,
      enum: ['Active', 'Selected', 'Offer Released', 'Joined', 'Rejected', 'On Hold'],
      default: 'Active',
      index: true,
    },
    nextAction: { type: String, trim: true, default: '' },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

module.exports = {
  RecruitmentPipeline:
    mongoose.models.RecruitmentPipeline ||
    mongoose.model('RecruitmentPipeline', recruitmentPipelineSchema, 'hr_recruitment_pipeline'),
  PIPELINE_STAGES,
  STAGE_STATUS_MAP,
};

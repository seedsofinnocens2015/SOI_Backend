const mongoose = require('mongoose');

const { Schema } = mongoose;

const CHECKLIST_ITEMS = [
  'offerLetterSigned',
  'idProofAadhaar',
  'panCard',
  'addressProof',
  'educationCertificates',
  'experienceRelievingLetter',
  'passportPhotos',
  'bankDetails',
  'employeeIdCreated',
  'emailSystemAccess',
  'inductionCompleted',
];

const checklistItemSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['Yes', 'Pending', 'No', 'NA'],
      default: 'Pending',
    },
    notApplicable: { type: Boolean, default: false },
  },
  { _id: false }
);

const onboardingChecklistSchema = new Schema(
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
    actualDoj: { type: Date, default: null }, // from JoiningTracker or Candidate

    offerLetterSigned: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    idProofAadhaar: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    panCard: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    addressProof: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    educationCertificates: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    experienceRelievingLetter: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    passportPhotos: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    bankDetails: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    employeeIdCreated: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    emailSystemAccess: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },
    inductionCompleted: { type: checklistItemSchema, default: () => ({ status: 'Pending', notApplicable: false }) },

    done: { type: Number, default: 0 },
    applicable: { type: Number, default: 11 },
    completionPct: { type: Number, default: 0 },
    onboardingStatus: {
      type: String,
      enum: ['Not Started', 'In Progress', 'Completed'],
      default: 'In Progress',
      index: true,
    },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

function calculateCompletion(doc) {
  let doneCount = 0;
  let applicableCount = 0;

  CHECKLIST_ITEMS.forEach((key) => {
    const item = doc[key] || {};
    if (!item.notApplicable && item.status !== 'NA') {
      applicableCount++;
      if (item.status === 'Yes') {
        doneCount++;
      }
    }
  });

  const pct = applicableCount > 0 ? Math.round((doneCount / applicableCount) * 100) : 100;
  doc.done = doneCount;
  doc.applicable = applicableCount;
  doc.completionPct = pct;

  if (pct === 100) {
    doc.onboardingStatus = 'Completed';
  } else if (doneCount > 0) {
    doc.onboardingStatus = 'In Progress';
  } else {
    doc.onboardingStatus = 'Not Started';
  }
}

onboardingChecklistSchema.pre('save', function (next) {
  calculateCompletion(this);
  next();
});

module.exports = {
  OnboardingChecklist:
    mongoose.models.OnboardingChecklist ||
    mongoose.model('OnboardingChecklist', onboardingChecklistSchema, 'hr_onboarding_checklist'),
  CHECKLIST_ITEMS,
  calculateCompletion,
};

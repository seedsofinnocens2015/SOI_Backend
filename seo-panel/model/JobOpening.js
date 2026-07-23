const mongoose = require('mongoose');

const { Schema } = mongoose;

const JOB_FIELDS = [
  'Accounts & Finance',
  'Admin & Operations',
  'Billing',
  'Business Development',
  'Call Center',
  'Clinical Operations',
  'Digital Marketing',
  'Embryology',
  'Facility & Maintenance',
  'Field Operations',
  'Human Resources',
  'IT',
  'IVF',
  'Lab Operations',
  'Management',
  'Molecular Biology',
  'Nursing',
  'OT Operations',
  'Pathology',
  'Patient Coordination',
  'Pharmacy',
  'Purchase & Procurement',
  'Quality & Compliances',
  'Sales & Marketing',
];

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Work from home', 'Alternate days'];

const jobOpeningSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    jobField: { type: String, required: true, enum: JOB_FIELDS },
    employmentType: { type: String, required: true, enum: EMPLOYMENT_TYPES },
    experience: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

jobOpeningSchema.index({ status: 1, createdAt: -1 });

module.exports = {
  JobOpening:
    mongoose.models.JobOpening || mongoose.model('JobOpening', jobOpeningSchema, 'hr_job_openings'),
  JOB_FIELDS,
  EMPLOYMENT_TYPES,
};

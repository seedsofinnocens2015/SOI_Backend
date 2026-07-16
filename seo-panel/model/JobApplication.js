const mongoose = require('mongoose');

const { Schema } = mongoose;

const jobApplicationSchema = new Schema(
  {
    jobOpeningId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true, index: true },
    positionTitle: { type: String, required: true, trim: true },
    positionLocation: { type: String, required: true, trim: true },
    jobField: { type: String, required: true, trim: true },
    employmentType: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    applicantExperience: { type: String, required: true, trim: true, maxlength: 80 },
    currentLocation: { type: String, required: true, trim: true, maxlength: 160 },
    noticePeriod: { type: String, required: true, trim: true, maxlength: 80 },
    qualification: { type: String, required: true, trim: true, maxlength: 240 },
    currentOrganization: { type: String, trim: true, maxlength: 240 },
    currentCtc: { type: String, required: true, trim: true, maxlength: 80 },
    expectedCtc: { type: String, required: true, trim: true, maxlength: 80 },
    coverLetter: { type: String, trim: true, maxlength: 4000 },
    status: {
      type: String,
      enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'],
      default: 'new',
      index: true,
    },
    resume: {
      originalName: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
      data: { type: Buffer, required: true, select: false },
    },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.JobApplication ||
  mongoose.model('JobApplication', jobApplicationSchema, 'hr_job_applications');

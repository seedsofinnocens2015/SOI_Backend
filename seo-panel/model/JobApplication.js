const mongoose = require('mongoose');

const { Schema } = mongoose;

const jobApplicationSchema = new Schema(
  {
    applicationType: { type: String, enum: ['job', 'general'], default: 'job', index: true },
    jobOpeningId: { type: Schema.Types.ObjectId, ref: 'JobOpening', index: true },
    positionTitle: { type: String, required: true, trim: true },
    positionLocation: { type: String, required: true, trim: true },
    jobField: { type: String, required: true, trim: true },
    employmentType: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    applicantExperience: { type: String, required: true, trim: true, maxlength: 80 },
    currentLocation: { type: String, required: true, trim: true, maxlength: 160 },
    noticePeriod: { type: String, trim: true, maxlength: 80 },
    qualification: { type: String, required: true, trim: true, maxlength: 240 },
    currentOrganization: { type: String, trim: true, maxlength: 240 },
    currentCtc: { type: String, trim: true, maxlength: 80 },
    expectedCtc: { type: String, trim: true, maxlength: 80 },
    coverLetter: { type: String, trim: true, maxlength: 4000 },
    department: { type: String, trim: true, maxlength: 160 },
    preferredPosition: { type: String, trim: true, maxlength: 240 },
    requirements: { type: String, trim: true, maxlength: 5000 },
    skills: { type: String, trim: true, maxlength: 5000 },
    additionalInfo: { type: String, trim: true, maxlength: 5000 },
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
      // Kept optional so applications saved before Cloudinary continue to download.
      data: { type: Buffer, select: false },
      cloudinaryPublicId: { type: String, select: false },
      cloudinaryAssetId: { type: String, select: false },
      cloudinaryVersion: { type: Number, select: false },
      cloudinaryResourceType: { type: String, select: false },
      cloudinaryDeliveryType: { type: String, select: false },
    },
  },
  { timestamps: true }
);

jobApplicationSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.JobApplication ||
  mongoose.model('JobApplication', jobApplicationSchema, 'hr_job_applications');

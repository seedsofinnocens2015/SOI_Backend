const mongoose = require('mongoose');
const JobApplication = require('../model/JobApplication');
const { JobOpening } = require('../model/JobOpening');
const { deleteResume, getSignedResumeUrl, uploadResume } = require('../services/resumeStorage');
const { sendApplicationNotificationEmail } = require('../services/applicationEmailService');

const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'];
const GENERAL_APPLICATION_JOB_FIELDS = [
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
const GENERAL_APPLICATION_JOB_FIELD_LABELS = Object.fromEntries(
  GENERAL_APPLICATION_JOB_FIELDS.map(label => [label.toLowerCase(), label])
);

const clean = value => String(value || '').trim();

function normalizeApplicantFields(body = {}) {
  return {
    fullName: clean(body.fullName),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone).replace(/\D/g, ''),
    applicantExperience: clean(body.applicantExperience ?? body.experience),
    currentLocation: clean(body.currentLocation ?? body.location),
    noticePeriod: clean(body.noticePeriod),
    qualification: clean(body.qualification),
    currentOrganization: clean(body.currentOrganization ?? body.currentOrg),
    currentCtc: clean(body.currentCtc),
    expectedCtc: clean(body.expectedCtc),
    coverLetter: clean(body.coverLetter),
  };
}

function validateApplicantFields(fields) {
  const requiredFields = [
    'fullName',
    'phone',
    'applicantExperience',
    'currentLocation',
    'noticePeriod',
    'qualification',
    'currentCtc',
    'expectedCtc',
  ];
  if (requiredFields.some(field => !fields[field])) {
    return 'Please complete all required application fields.';
  }
  if (!/^[6-9]\d{9}$/.test(fields.phone)) {
    return 'Please enter a valid 10-digit phone number.';
  }
  return '';
}

function normalizeGeneralApplicantFields(body = {}) {
  return {
    fullName: clean(body.fullName),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone).replace(/\D/g, ''),
    applicantExperience: clean(body.applicantExperience ?? body.experience),
    currentLocation: clean(body.currentLocation ?? body.location),
    qualification: clean(body.qualification),
    department: clean(body.department).toLowerCase(),
    preferredPosition: clean(body.preferredPosition),
    requirements: clean(body.requirements),
    skills: clean(body.skills),
    additionalInfo: clean(body.additionalInfo ?? body.coverLetter),
  };
}

function validateGeneralApplicantFields(fields) {
  const requiredFields = [
    'fullName',
    'phone',
    'applicantExperience',
    'currentLocation',
    'qualification',
    'department',
    'preferredPosition',
    'requirements',
  ];
  if (requiredFields.some(field => !fields[field])) {
    return 'Please complete all required general application fields.';
  }
  if (!/^[6-9]\d{9}$/.test(fields.phone)) {
    return 'Please enter a valid 10-digit phone number.';
  }
  return '';
}

async function createApplication(req, res) {
  let uploadedResume = null;
  try {
    const jobOpeningId = clean(req.body?.jobOpeningId);
    if (!mongoose.Types.ObjectId.isValid(jobOpeningId)) {
      return res.status(400).json({ ok: false, error: 'Please select a valid current opening.' });
    }

    const job = await JobOpening.findOne({ _id: jobOpeningId, status: 'published' }).lean();
    if (!job) {
      return res.status(400).json({ ok: false, error: 'This job opening is no longer available.' });
    }

    const fields = normalizeApplicantFields(req.body);
    const validationError = validateApplicantFields(fields);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Resume/CV is required.' });
    }

    uploadedResume = await uploadResume(req.file, fields.fullName);

    const application = await JobApplication.create({
      jobOpeningId: job._id,
      positionTitle: job.title,
      positionLocation: job.location,
      jobField: job.jobField,
      employmentType: job.employmentType,
      ...fields,
      resume: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        cloudinaryPublicId: uploadedResume.publicId,
        cloudinaryAssetId: uploadedResume.assetId,
        cloudinaryVersion: uploadedResume.version,
        cloudinaryResourceType: uploadedResume.resourceType,
        cloudinaryDeliveryType: uploadedResume.deliveryType,
      },
    });

    await sendApplicationNotificationEmail(application, req.file).catch(emailError => {
      console.error('[HR][applications][notificationEmail] Error', emailError.message);
    });

    return res.status(201).json({
      ok: true,
      data: { id: application._id, message: 'Application submitted successfully.' },
    });
  } catch (error) {
    console.error('[HR][applications][createApplication] Error', error);
    if (uploadedResume?.publicId) {
      await deleteResume({
        cloudinaryPublicId: uploadedResume.publicId,
        cloudinaryResourceType: uploadedResume.resourceType,
        cloudinaryDeliveryType: uploadedResume.deliveryType,
      }).catch(cleanupError => {
        console.error('[HR][applications][resumeCleanup] Error', cleanupError.message);
      });
    }
    return res.status(500).json({ ok: false, error: 'Unable to submit the application.' });
  }
}

async function createGeneralApplication(req, res) {
  let uploadedResume = null;
  try {
    const fields = normalizeGeneralApplicantFields(req.body);
    const validationError = validateGeneralApplicantFields(fields);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Resume/CV is required.' });
    }

    uploadedResume = await uploadResume(req.file, fields.fullName);
    const departmentLabel = GENERAL_APPLICATION_JOB_FIELD_LABELS[fields.department] || fields.department;
    const application = await JobApplication.create({
      applicationType: 'general',
      positionTitle: fields.preferredPosition,
      positionLocation: fields.currentLocation,
      jobField: departmentLabel,
      employmentType: 'Not specified',
      ...fields,
      coverLetter: fields.additionalInfo,
      resume: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        cloudinaryPublicId: uploadedResume.publicId,
        cloudinaryAssetId: uploadedResume.assetId,
        cloudinaryVersion: uploadedResume.version,
        cloudinaryResourceType: uploadedResume.resourceType,
        cloudinaryDeliveryType: uploadedResume.deliveryType,
      },
    });

    await sendApplicationNotificationEmail(application, req.file).catch(emailError => {
      console.error('[HR][applications][generalNotificationEmail] Error', emailError.message);
    });

    return res.status(201).json({
      ok: true,
      data: { id: application._id, message: 'General application submitted successfully.' },
    });
  } catch (error) {
    console.error('[HR][applications][createGeneralApplication] Error', error);
    if (uploadedResume?.publicId) {
      await deleteResume({
        cloudinaryPublicId: uploadedResume.publicId,
        cloudinaryResourceType: uploadedResume.resourceType,
        cloudinaryDeliveryType: uploadedResume.deliveryType,
      }).catch(cleanupError => {
        console.error('[HR][applications][generalResumeCleanup] Error', cleanupError.message);
      });
    }
    return res.status(500).json({ ok: false, error: 'Unable to submit the general application.' });
  }
}

async function listApplications(_req, res) {
  try {
    const applications = await JobApplication.find({})
      .select('-resume.data')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ ok: true, data: applications });
  } catch (error) {
    console.error('[HR][applications][listApplications] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to load applications.' });
  }
}

async function getApplication(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid application id.' });
    }
    const application = await JobApplication.findById(req.params.id).select('-resume.data').lean();
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });
    return res.status(200).json({ ok: true, data: application });
  } catch (error) {
    console.error('[HR][applications][getApplication] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to load application.' });
  }
}

async function downloadResume(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid application id.' });
    }
    const application = await JobApplication.findById(req.params.id)
      .select('+resume.data +resume.cloudinaryPublicId +resume.cloudinaryAssetId +resume.cloudinaryVersion +resume.cloudinaryResourceType +resume.cloudinaryDeliveryType')
      .lean();
    if (!application?.resume?.data && !application?.resume?.cloudinaryPublicId) {
      return res.status(404).json({ ok: false, error: 'Resume not found.' });
    }
    const safeName = String(application.resume.originalName || 'resume')
      .replace(/[\r\n"\\/]/g, '_');
    res.setHeader('Content-Type', application.resume.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    // Backward compatibility for applications submitted before Cloudinary storage.
    if (application.resume.data) {
      res.setHeader('Content-Length', application.resume.data.length);
      return res.send(application.resume.data);
    }

    const cloudinaryResponse = await fetch(getSignedResumeUrl(application.resume));
    if (!cloudinaryResponse.ok || !cloudinaryResponse.body) {
      throw new Error(`Cloudinary resume download failed (${cloudinaryResponse.status}).`);
    }
    if (cloudinaryResponse.headers.get('content-length')) {
      res.setHeader('Content-Length', cloudinaryResponse.headers.get('content-length'));
    }
    const resumeBuffer = Buffer.from(await cloudinaryResponse.arrayBuffer());
    return res.send(resumeBuffer);
  } catch (error) {
    console.error('[HR][applications][downloadResume] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to download resume.' });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const status = clean(req.body?.status).toLowerCase();
    if (!APPLICATION_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: 'Invalid application status.' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid application id.' });
    }
    const application = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-resume.data');
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });
    return res.status(200).json({ ok: true, data: application });
  } catch (error) {
    console.error('[HR][applications][updateStatus] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to update application status.' });
  }
}

async function updateApplication(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid application id.' });
    }
    const existingApplication = await JobApplication.findById(req.params.id).lean();
    if (!existingApplication) return res.status(404).json({ ok: false, error: 'Application not found.' });

    const isGeneral = existingApplication.applicationType === 'general';
    const normalizedFields = isGeneral
      ? normalizeGeneralApplicantFields(req.body)
      : normalizeApplicantFields(req.body);
    const validationError = isGeneral
      ? validateGeneralApplicantFields(normalizedFields)
      : validateApplicantFields(normalizedFields);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const fields = isGeneral
      ? {
          ...normalizedFields,
          positionTitle: normalizedFields.preferredPosition,
          positionLocation: normalizedFields.currentLocation,
          jobField:
            GENERAL_APPLICATION_JOB_FIELD_LABELS[normalizedFields.department] ||
            normalizedFields.department,
          coverLetter: normalizedFields.additionalInfo,
        }
      : normalizedFields;

    const application = await JobApplication.findByIdAndUpdate(
      req.params.id,
      { $set: fields },
      { new: true, runValidators: true }
    ).select('-resume.data');
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });
    return res.status(200).json({ ok: true, data: application });
  } catch (error) {
    console.error('[HR][applications][updateApplication] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to update application.' });
  }
}

async function deleteApplication(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid application id.' });
    }
    const application = await JobApplication.findById(req.params.id)
      .select('+resume.cloudinaryPublicId +resume.cloudinaryResourceType +resume.cloudinaryDeliveryType')
      .lean();
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found.' });

    // Remove Cloudinary bytes first. Legacy Mongo-stored resumes do not have this reference.
    await deleteResume(application.resume);
    await JobApplication.findByIdAndDelete(application._id);
    return res.status(200).json({ ok: true, data: { id: application._id } });
  } catch (error) {
    console.error('[HR][applications][deleteApplication] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete application and resume.' });
  }
}

module.exports = {
  createApplication,
  createGeneralApplication,
  listApplications,
  getApplication,
  downloadResume,
  updateApplication,
  updateApplicationStatus,
  deleteApplication,
};

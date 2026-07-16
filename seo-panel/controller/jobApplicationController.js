const mongoose = require('mongoose');
const JobApplication = require('../model/JobApplication');
const { JobOpening } = require('../model/JobOpening');

const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'];

const clean = value => String(value || '').trim();

async function createApplication(req, res) {
  try {
    const jobOpeningId = clean(req.body?.jobOpeningId);
    if (!mongoose.Types.ObjectId.isValid(jobOpeningId)) {
      return res.status(400).json({ ok: false, error: 'Please select a valid current opening.' });
    }

    const job = await JobOpening.findOne({ _id: jobOpeningId, status: 'published' }).lean();
    if (!job) {
      return res.status(400).json({ ok: false, error: 'This job opening is no longer available.' });
    }

    const fields = {
      fullName: clean(req.body?.fullName),
      email: clean(req.body?.email).toLowerCase(),
      phone: clean(req.body?.phone).replace(/\D/g, ''),
      applicantExperience: clean(req.body?.experience),
      currentLocation: clean(req.body?.location),
      noticePeriod: clean(req.body?.noticePeriod),
      qualification: clean(req.body?.qualification),
      currentOrganization: clean(req.body?.currentOrg),
      currentCtc: clean(req.body?.currentCtc),
      expectedCtc: clean(req.body?.expectedCtc),
      coverLetter: clean(req.body?.coverLetter),
    };

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
      return res.status(400).json({ ok: false, error: 'Please complete all required application fields.' });
    }
    if (!/^[6-9]\d{9}$/.test(fields.phone)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid 10-digit phone number.' });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Resume/CV is required.' });
    }

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
        data: req.file.buffer,
      },
    });

    return res.status(201).json({
      ok: true,
      data: { id: application._id, message: 'Application submitted successfully.' },
    });
  } catch (error) {
    console.error('[HR][applications][createApplication] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to submit the application.' });
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
    const application = await JobApplication.findById(req.params.id).select('+resume.data').lean();
    if (!application?.resume?.data) {
      return res.status(404).json({ ok: false, error: 'Resume not found.' });
    }
    const safeName = String(application.resume.originalName || 'resume')
      .replace(/[\r\n"\\/]/g, '_');
    res.setHeader('Content-Type', application.resume.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', application.resume.size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    return res.send(application.resume.data);
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

module.exports = {
  createApplication,
  listApplications,
  getApplication,
  downloadResume,
  updateApplicationStatus,
};

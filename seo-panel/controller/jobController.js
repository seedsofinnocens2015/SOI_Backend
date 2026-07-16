const mongoose = require('mongoose');
const { JobOpening, JOB_FIELDS, EMPLOYMENT_TYPES } = require('../model/JobOpening');

function normalizePayload(body = {}) {
  return {
    title: String(body.title || '').trim(),
    location: String(body.location || '').trim(),
    jobField: String(body.jobField || '').trim(),
    employmentType: String(body.employmentType || '').trim(),
    experience: String(body.experience || '').trim(),
    description: String(body.description || '').trim(),
    status: body.status === 'draft' ? 'draft' : 'published',
  };
}

function validatePayload(payload) {
  const requiredFields = ['title', 'location', 'jobField', 'employmentType', 'experience', 'description'];
  const missingField = requiredFields.find(field => !payload[field]);
  if (missingField) return `${missingField} is required`;
  if (!JOB_FIELDS.includes(payload.jobField)) return 'Invalid job field';
  if (!EMPLOYMENT_TYPES.includes(payload.employmentType)) return 'Invalid employment type';
  return '';
}

async function listPublishedJobs(_req, res) {
  try {
    const jobs = await JobOpening.find({ status: 'published' }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ ok: true, data: jobs });
  } catch (error) {
    console.error('[HR][jobs][listPublishedJobs] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to load job openings' });
  }
}

async function listManagedJobs(_req, res) {
  try {
    const jobs = await JobOpening.find({}).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ ok: true, data: jobs });
  } catch (error) {
    console.error('[HR][jobs][listManagedJobs] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to load job openings' });
  }
}

async function createJob(req, res) {
  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const createdBy = mongoose.Types.ObjectId.isValid(req.seoUser?.userId)
      ? req.seoUser.userId
      : null;
    const job = await JobOpening.create({ ...payload, createdBy });
    return res.status(201).json({ ok: true, data: job });
  } catch (error) {
    console.error('[HR][jobs][createJob] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to create job opening' });
  }
}

async function updateJob(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid job id' });
    }
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ ok: false, error: validationError });

    const job = await JobOpening.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!job) return res.status(404).json({ ok: false, error: 'Job opening not found' });
    return res.status(200).json({ ok: true, data: job });
  } catch (error) {
    console.error('[HR][jobs][updateJob] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to update job opening' });
  }
}

async function deleteJob(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ ok: false, error: 'Invalid job id' });
    }
    const job = await JobOpening.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ ok: false, error: 'Job opening not found' });
    return res.status(200).json({ ok: true, data: { id: req.params.id } });
  } catch (error) {
    console.error('[HR][jobs][deleteJob] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to delete job opening' });
  }
}

module.exports = { listPublishedJobs, listManagedJobs, createJob, updateJob, deleteJob };

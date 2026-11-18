const { CandidateMaster } = require('../model/CandidateMaster');
const { ManpowerRequisition } = require('../model/ManpowerRequisition');
const { RecruitmentPipeline } = require('../model/RecruitmentPipeline');
const { uploadResumeBuffer } = require('../services/resumeStorage');
const { parseResumeBuffer } = require('../services/resumeParserService');

async function listCandidates(req, res) {
  try {
    const { centre, requisitionId, search, currentStage, pipelineStatus } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (requisitionId && requisitionId !== 'all') {
      filter.requisitionId = requisitionId;
    }
    if (currentStage && currentStage !== 'all') {
      filter.currentStage = currentStage;
    }
    if (pipelineStatus && pipelineStatus !== 'all') {
      filter.pipelineStatus = pipelineStatus;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { candidateId: regex },
        { candidateName: regex },
        { mobile: regex },
        { email: regex },
        { reqIdStr: regex },
        { centre: regex },
        { department: regex },
        { designation: regex },
        { recruiter: regex },
        { source: regex },
      ];
    }

    const docs = await CandidateMaster.find(filter)
      .populate('requisitionId', 'reqId centre department designation positionsRequired recruiterAssigned')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ ok: true, data: docs });
  } catch (error) {
    console.error('Error listing candidates:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load candidates.' });
  }
}

async function getNextCandidateId(req, res) {
  try {
    const lastDoc = await CandidateMaster.findOne({}, { candidateId: 1 })
      .sort({ createdAt: -1 })
      .lean();
    let nextNum = 1;
    if (lastDoc && lastDoc.candidateId) {
      const match = lastDoc.candidateId.match(/CAN-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const nextCandidateId = `CAN-${String(nextNum).padStart(4, '0')}`;
    return res.status(200).json({ ok: true, data: { nextCandidateId } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to generate Candidate ID' });
  }
}

async function createCandidate(req, res) {
  try {
    const {
      company,
      dateAdded,
      candidateName,
      mobile,
      email,
      requisitionId,
      source,
      recruiter,
      centre,
      department,
      designation,
      totalExpYrs,
      currentCtcLakh,
      expectedCtcLakh,
      noticePeriodDays,
      currentLocation,
      remarks,
    } = req.body;

    if (!candidateName || !mobile) {
      return res.status(400).json({ ok: false, error: 'Candidate Name and Mobile are required.' });
    }

    let reqIdStr = '';
    let autoCentre = centre || '';
    let autoDept = department || '';
    let autoDesig = designation || '';
    let autoRecruiter = recruiter || '';

    if (requisitionId) {
      const reqDoc = await ManpowerRequisition.findById(requisitionId).lean();
      if (reqDoc) {
        reqIdStr = reqDoc.reqId || '';
        if (!autoCentre) autoCentre = reqDoc.centre || '';
        if (!autoDept) autoDept = reqDoc.department || '';
        if (!autoDesig) autoDesig = reqDoc.designation || '';
        if (!autoRecruiter) autoRecruiter = reqDoc.recruiterAssigned || '';
      }
    }

    let resumeData = undefined;
    if (req.file) {
      const uploaded = await uploadResumeBuffer(req.file);
      resumeData = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: uploaded.mode === 'inline' ? uploaded.data : undefined,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        cloudinaryAssetId: uploaded.cloudinaryAssetId,
        cloudinaryVersion: uploaded.cloudinaryVersion,
        cloudinaryResourceType: uploaded.cloudinaryResourceType,
        cloudinaryDeliveryType: uploaded.cloudinaryDeliveryType,
      };
    }

    const newCandidate = new CandidateMaster({
      company: company || 'Seeds of Innocence',
      dateAdded: dateAdded ? new Date(dateAdded) : new Date(),
      candidateName: candidateName.trim(),
      mobile: mobile.trim(),
      email: email?.trim() || '',
      requisitionId: requisitionId || null,
      reqIdStr,
      source: source || 'Direct',
      recruiter: autoRecruiter,
      centre: autoCentre,
      department: autoDept,
      designation: autoDesig,
      totalExpYrs: totalExpYrs?.trim() || '',
      currentCtcLakh: currentCtcLakh?.trim() || '',
      expectedCtcLakh: expectedCtcLakh?.trim() || '',
      noticePeriodDays: noticePeriodDays?.trim() || '',
      currentLocation: currentLocation?.trim() || '',
      roundsDone: 0,
      currentStage: 'Sourced',
      pipelineStatus: 'Active',
      remarks: remarks?.trim() || '',
      resume: resumeData,
      createdBy: req.user?._id || null,
    });

    await newCandidate.save();

    // Automatically create pipeline entry (Sourced)
    try {
      await RecruitmentPipeline.create({
        candidateId: newCandidate._id,
        candidateIdStr: newCandidate.candidateId || '',
        candidateName: newCandidate.candidateName,
        company: newCandidate.company || 'Seeds of Innocence',
        centre: newCandidate.centre || '',
        designation: newCandidate.designation || '',
        recruiter: newCandidate.recruiter || '',
        source: newCandidate.source || '',
        currentStage: 'Sourced',
        stageDate: newCandidate.dateAdded || new Date(),
        pipelineStatus: 'Active',
        nextAction: 'Initial Screening',
        remarks: newCandidate.remarks || 'Auto-created from Candidate Master',
        createdBy: req.user?._id || null,
      });
    } catch (pipelineErr) {
      console.warn('Auto pipeline creation notice:', pipelineErr.message);
    }

    return res.status(201).json({ ok: true, data: newCandidate });
  } catch (error) {
    console.error('Error creating candidate:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to register candidate.' });
  }
}

async function updateCandidate(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.requisitionId) {
      const reqDoc = await ManpowerRequisition.findById(body.requisitionId).lean();
      if (reqDoc) {
        body.reqIdStr = reqDoc.reqId || '';
        if (!body.centre) body.centre = reqDoc.centre || '';
        if (!body.department) body.department = reqDoc.department || '';
        if (!body.designation) body.designation = reqDoc.designation || '';
        if (!body.recruiter) body.recruiter = reqDoc.recruiterAssigned || '';
      }
    }

    if (req.file) {
      const uploaded = await uploadResumeBuffer(req.file);
      body.resume = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        data: uploaded.mode === 'inline' ? uploaded.data : undefined,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        cloudinaryAssetId: uploaded.cloudinaryAssetId,
        cloudinaryVersion: uploaded.cloudinaryVersion,
        cloudinaryResourceType: uploaded.cloudinaryResourceType,
        cloudinaryDeliveryType: uploaded.cloudinaryDeliveryType,
      };
    }

    const updated = await CandidateMaster.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating candidate:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update candidate.' });
  }
}

async function deleteCandidate(req, res) {
  try {
    const { id } = req.params;
    const deleted = await CandidateMaster.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete candidate.' });
  }
}

async function parseCandidateCv(req, res) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, error: 'Please upload a resume file to parse.' });
    }

    const result = await parseResumeBuffer(req.file.buffer, req.file.originalname || 'resume');
    return res.status(200).json({
      ok: true,
      data: result.data || {},
      method: result.method,
      textLength: result.textLength,
    });
  } catch (error) {
    console.error('Error parsing candidate CV:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to parse resume.' });
  }
}

module.exports = {
  listCandidates,
  getNextCandidateId,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  parseCandidateCv,
};

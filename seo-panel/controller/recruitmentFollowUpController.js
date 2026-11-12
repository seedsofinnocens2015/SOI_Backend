const { RecruitmentFollowUp } = require('../model/RecruitmentFollowUp');
const { CandidateMaster } = require('../model/CandidateMaster');

function computeAlert(followUpStatus, nextFollowUpDate) {
  if (followUpStatus !== 'Open' || !nextFollowUpDate) return '-';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDate = new Date(nextFollowUpDate);
  nextDate.setHours(0, 0, 0, 0);

  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Overdue';
  } else if (diffDays === 0) {
    return 'Due Today';
  } else if (diffDays === 1) {
    return 'Due Tomorrow';
  } else {
    return `In ${diffDays} days`;
  }
}

// GET /api/recruitment-follow-up
async function listFollowUps(req, res) {
  try {
    const { search = '', centre = '' } = req.query;
    const query = {};

    if (centre && centre !== 'All centres') {
      query.centre = centre;
    }

    if (search.trim()) {
      const s = search.trim();
      const sRegex = new RegExp(s, 'i');
      query.$or = [
        { candidateCode: sRegex },
        { candidateName: sRegex },
        { recruiter: sRegex },
        { mode: sRegex },
        { discussionOutcome: sRegex },
      ];
    }

    const records = await RecruitmentFollowUp.find(query)
      .sort({ followUpDate: -1, createdAt: -1 })
      .lean();

    const withAlerts = records.map((r) => ({
      ...r,
      id: r._id,
      alert: computeAlert(r.followUpStatus, r.nextFollowUpDate),
    }));

    return res.status(200).json({ ok: true, data: withAlerts });
  } catch (error) {
    console.error('[RecruitmentFollowUp][listFollowUps] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to load follow-ups' });
  }
}

// POST /api/recruitment-follow-up
async function createFollowUp(req, res) {
  try {
    const {
      followUpDate,
      candidateId,
      recruiter,
      mode,
      discussionOutcome,
      nextFollowUpDate,
      followUpStatus = 'Open',
      remarks = '',
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({ ok: false, error: 'Candidate is required' });
    }

    const candidate = await CandidateMaster.findById(candidateId).lean();
    if (!candidate) {
      return res.status(404).json({ ok: false, error: 'Candidate not found' });
    }

    const newRecord = await RecruitmentFollowUp.create({
      followUpDate: followUpDate ? new Date(followUpDate) : new Date(),
      candidateId: candidate._id,
      candidateCode: candidate.candidateId || '',
      candidateName: candidate.candidateName,
      company: candidate.company || 'Seeds of Innocence',
      centre: candidate.centre || '',
      recruiter: recruiter || candidate.recruiter || '',
      mode: mode || 'Call',
      discussionOutcome: discussionOutcome || '',
      nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
      followUpStatus: followUpStatus || 'Open',
      remarks: remarks || '',
    });

    const alert = computeAlert(newRecord.followUpStatus, newRecord.nextFollowUpDate);

    return res.status(201).json({
      ok: true,
      data: {
        ...newRecord.toObject(),
        id: newRecord._id,
        alert,
      },
    });
  } catch (error) {
    console.error('[RecruitmentFollowUp][createFollowUp] Error', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to create follow-up' });
  }
}

// PUT /api/recruitment-follow-up/:id
async function updateFollowUp(req, res) {
  try {
    const { id } = req.params;
    const {
      followUpDate,
      candidateId,
      recruiter,
      mode,
      discussionOutcome,
      nextFollowUpDate,
      followUpStatus,
      remarks,
    } = req.body;

    const record = await RecruitmentFollowUp.findById(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: 'Follow-up not found' });
    }

    if (candidateId && String(candidateId) !== String(record.candidateId)) {
      const candidate = await CandidateMaster.findById(candidateId).lean();
      if (candidate) {
        record.candidateId = candidate._id;
        record.candidateCode = candidate.candidateId || '';
        record.candidateName = candidate.candidateName;
        record.company = candidate.company || record.company;
        record.centre = candidate.centre || record.centre;
      }
    }

    if (followUpDate) record.followUpDate = new Date(followUpDate);
    if (typeof recruiter === 'string') record.recruiter = recruiter.trim();
    if (typeof mode === 'string') record.mode = mode.trim();
    if (typeof discussionOutcome === 'string') record.discussionOutcome = discussionOutcome.trim();
    if (nextFollowUpDate !== undefined) {
      record.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
    }
    if (typeof followUpStatus === 'string') record.followUpStatus = followUpStatus.trim();
    if (typeof remarks === 'string') record.remarks = remarks.trim();

    await record.save();

    const alert = computeAlert(record.followUpStatus, record.nextFollowUpDate);

    return res.status(200).json({
      ok: true,
      data: {
        ...record.toObject(),
        id: record._id,
        alert,
      },
    });
  } catch (error) {
    console.error('[RecruitmentFollowUp][updateFollowUp] Error', error);
    return res.status(500).json({ ok: false, error: error.message || 'Failed to update follow-up' });
  }
}

// DELETE /api/recruitment-follow-up/:id
async function deleteFollowUp(req, res) {
  try {
    const { id } = req.params;
    const record = await RecruitmentFollowUp.findByIdAndDelete(id);
    if (!record) {
      return res.status(404).json({ ok: false, error: 'Follow-up not found' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('[RecruitmentFollowUp][deleteFollowUp] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to delete follow-up' });
  }
}

module.exports = {
  listFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
};

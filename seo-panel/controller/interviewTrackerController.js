const {
  InterviewTracker,
  INTERVIEW_ROUNDS,
  INTERVIEW_MODES,
  INTERVIEW_STATUSES,
  INTERVIEW_RESULTS,
} = require('../model/InterviewTracker');
const { CandidateMaster } = require('../model/CandidateMaster');

async function listInterviews(req, res) {
  try {
    const { centre, round, status, result, search, candidateId } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (round && round !== 'All rounds' && round !== 'all') {
      filter.interviewRound = round;
    }
    if (status && status !== 'all') {
      filter.interviewStatus = status;
    }
    if (result && result !== 'all') {
      filter.result = result;
    }
    if (candidateId) {
      filter.candidateId = candidateId;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { candidateIdStr: regex },
        { candidateName: regex },
        { company: regex },
        { centre: regex },
        { designation: regex },
        { recruiter: regex },
        { interviewer: regex },
        { feedback: regex },
      ];
    }

    const docs = await InterviewTracker.find(filter)
      .populate('candidateId', 'candidateId candidateName mobile email centre designation recruiter currentStage')
      .sort({ interviewDate: -1, createdAt: -1 })
      .lean();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const enriched = docs.map((doc) => {
      let alert = '';
      const intDateStr = doc.interviewDate ? new Date(doc.interviewDate).toISOString().slice(0, 10) : '';

      if (doc.interviewStatus === 'Completed' && (!doc.feedback || doc.result === 'Pending')) {
        alert = 'Feedback Pending';
      } else if (doc.interviewStatus === 'Scheduled') {
        if (intDateStr === todayStr) {
          alert = 'Today / Due Soon';
        } else if (new Date(doc.interviewDate) < now) {
          alert = 'Update Status';
        }
      }

      return {
        ...doc,
        alert,
      };
    });

    return res.status(200).json({
      ok: true,
      data: enriched,
      meta: {
        rounds: INTERVIEW_ROUNDS,
        modes: INTERVIEW_MODES,
        statuses: INTERVIEW_STATUSES,
        results: INTERVIEW_RESULTS,
      },
    });
  } catch (error) {
    console.error('Error listing interview tracker:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load interview records.' });
  }
}

async function listCandidateWise(req, res) {
  try {
    const { search, centre, stage } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (stage && stage !== 'All stages' && stage !== 'all') {
      filter.currentStage = stage;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { candidateId: regex },
        { candidateName: regex },
        { mobile: regex },
        { centre: regex },
        { designation: regex },
        { recruiter: regex },
      ];
    }

    const candidates = await CandidateMaster.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const candidateIds = candidates.map((c) => c._id);
    const interviews = await InterviewTracker.find({ candidateId: { $in: candidateIds } })
      .sort({ interviewDate: 1 })
      .lean();

    const interviewsByCandidate = {};
    interviews.forEach((item) => {
      const cId = String(item.candidateId);
      if (!interviewsByCandidate[cId]) {
        interviewsByCandidate[cId] = {};
      }
      interviewsByCandidate[cId][item.interviewRound] = item;
    });

    const result = candidates.map((c) => {
      const rounds = interviewsByCandidate[String(c._id)] || {};
      return {
        _id: c._id,
        candidateId: c.candidateId,
        candidateName: c.candidateName,
        mobile: c.mobile,
        stage: c.currentStage || 'Screening',
        recruiter: c.recruiter || '-',
        company: c.company || 'Seeds of Innocence',
        centre: c.centre || '-',
        designation: c.designation || '-',
        screeningCall: rounds['Screening Call'] || null,
        round1Hr: rounds['Round 1 - HR'] || null,
        round2Dept: rounds['Round 2 - Department'] || null,
        round3Mgmt: rounds['Round 3 - Final / Management'] || null,
        assignmentTest: rounds['Assignment / Test'] || null,
        remarks: c.remarks || '-',
      };
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    console.error('Error listing candidate wise interviews:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load candidate-wise interviews.' });
  }
}

async function createInterview(req, res) {
  try {
    const {
      candidateId,
      interviewRound,
      interviewer,
      interviewDate,
      time,
      mode,
      interviewStatus,
      result,
      rating,
      feedback,
    } = req.body;

    if (!candidateId || !interviewRound) {
      return res.status(400).json({ ok: false, error: 'Candidate and Interview Round are required.' });
    }

    const candidateDoc = await CandidateMaster.findById(candidateId).lean();
    if (!candidateDoc) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    const newInterview = new InterviewTracker({
      candidateId: candidateDoc._id,
      candidateIdStr: candidateDoc.candidateId || '',
      candidateName: candidateDoc.candidateName,
      company: candidateDoc.company || 'Seeds of Innocence',
      centre: candidateDoc.centre || '',
      designation: candidateDoc.designation || '',
      recruiter: candidateDoc.recruiter || '',
      stage: candidateDoc.currentStage || 'Screening',
      interviewRound,
      interviewer: interviewer?.trim() || '',
      interviewDate: interviewDate ? new Date(interviewDate) : new Date(),
      time: time?.trim() || '',
      mode: mode || 'Online / Video',
      interviewStatus: interviewStatus || 'Scheduled',
      result: result || 'Pending',
      rating: rating?.trim() || '',
      feedback: feedback?.trim() || '',
      createdBy: req.user?._id || null,
    });

    await newInterview.save();

    // Increment roundsDone in CandidateMaster
    const totalRounds = await InterviewTracker.countDocuments({ candidateId: candidateDoc._id });
    await CandidateMaster.findByIdAndUpdate(candidateDoc._id, { roundsDone: totalRounds });

    return res.status(201).json({ ok: true, data: newInterview });
  } catch (error) {
    console.error('Error creating interview:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to schedule interview.' });
  }
}

async function updateInterview(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.candidateId) {
      const candidateDoc = await CandidateMaster.findById(body.candidateId).lean();
      if (candidateDoc) {
        body.candidateIdStr = candidateDoc.candidateId || '';
        body.candidateName = candidateDoc.candidateName;
        body.company = candidateDoc.company || 'Seeds of Innocence';
        body.centre = candidateDoc.centre || '';
        body.designation = candidateDoc.designation || '';
        body.recruiter = candidateDoc.recruiter || '';
        body.stage = candidateDoc.currentStage || 'Screening';
      }
    }

    if (body.interviewDate) {
      body.interviewDate = new Date(body.interviewDate);
    }

    const updated = await InterviewTracker.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Interview record not found.' });
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating interview:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update interview.' });
  }
}

async function deleteInterview(req, res) {
  try {
    const { id } = req.params;
    const deleted = await InterviewTracker.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Interview record not found.' });
    }

    if (deleted.candidateId) {
      const totalRounds = await InterviewTracker.countDocuments({ candidateId: deleted.candidateId });
      await CandidateMaster.findByIdAndUpdate(deleted.candidateId, { roundsDone: totalRounds });
    }

    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting interview:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete interview record.' });
  }
}

module.exports = {
  listInterviews,
  listCandidateWise,
  createInterview,
  updateInterview,
  deleteInterview,
};

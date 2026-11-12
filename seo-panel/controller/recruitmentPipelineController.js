const {
  RecruitmentPipeline,
  PIPELINE_STAGES,
  STAGE_STATUS_MAP,
} = require('../model/RecruitmentPipeline');
const { CandidateMaster } = require('../model/CandidateMaster');

async function listPipeline(req, res) {
  try {
    const { centre, currentStage, pipelineStatus, search } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
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
        { candidateIdStr: regex },
        { candidateName: regex },
        { company: regex },
        { centre: regex },
        { designation: regex },
        { recruiter: regex },
        { source: regex },
        { nextAction: regex },
        { remarks: regex },
      ];
    }

    const docs = await RecruitmentPipeline.find(filter)
      .populate('candidateId', 'candidateId candidateName mobile email centre designation recruiter')
      .sort({ updatedAt: -1 })
      .lean();

    const now = new Date();
    const enriched = docs.map((doc) => {
      const start = doc.createdAt ? new Date(doc.createdAt) : now;
      const diffMs = Math.max(0, now - start);
      const daysInPipeline = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...doc,
        daysInPipeline,
      };
    });

    return res.status(200).json({
      ok: true,
      data: enriched,
      meta: {
        stages: PIPELINE_STAGES,
        stageStatusMap: STAGE_STATUS_MAP,
      },
    });
  } catch (error) {
    console.error('Error listing recruitment pipeline:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load recruitment pipeline.' });
  }
}

async function createPipelineEntry(req, res) {
  try {
    const { candidateId, currentStage, stageDate, nextAction, remarks } = req.body;

    if (!candidateId) {
      return res.status(400).json({ ok: false, error: 'Candidate is required.' });
    }

    const candidateDoc = await CandidateMaster.findById(candidateId).lean();
    if (!candidateDoc) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    const stage = currentStage || 'Sourced';
    const status = STAGE_STATUS_MAP[stage] || 'Active';

    const pipelineEntry = new RecruitmentPipeline({
      candidateId: candidateDoc._id,
      candidateIdStr: candidateDoc.candidateId || '',
      candidateName: candidateDoc.candidateName,
      company: candidateDoc.company || 'Seeds of Innocence',
      centre: candidateDoc.centre || '',
      designation: candidateDoc.designation || '',
      recruiter: candidateDoc.recruiter || '',
      source: candidateDoc.source || '',
      currentStage: stage,
      stageDate: stageDate ? new Date(stageDate) : new Date(),
      pipelineStatus: status,
      nextAction: nextAction?.trim() || '',
      remarks: remarks?.trim() || '',
      createdBy: req.user?._id || null,
    });

    await pipelineEntry.save();

    // Sync back to CandidateMaster
    await CandidateMaster.findByIdAndUpdate(candidateDoc._id, {
      currentStage: stage,
      pipelineStatus: status,
    });

    return res.status(201).json({ ok: true, data: pipelineEntry });
  } catch (error) {
    console.error('Error creating pipeline entry:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to create pipeline entry.' });
  }
}

async function updatePipelineEntry(req, res) {
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
        body.source = candidateDoc.source || '';
      }
    }

    if (body.currentStage) {
      body.pipelineStatus = STAGE_STATUS_MAP[body.currentStage] || 'Active';
    }

    if (body.stageDate) {
      body.stageDate = new Date(body.stageDate);
    }

    const updated = await RecruitmentPipeline.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Pipeline entry not found.' });
    }

    // Sync back to CandidateMaster if stage updated
    if (updated.candidateId) {
      await CandidateMaster.findByIdAndUpdate(updated.candidateId, {
        currentStage: updated.currentStage,
        pipelineStatus: updated.pipelineStatus,
      });
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating pipeline entry:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update pipeline entry.' });
  }
}

async function deletePipelineEntry(req, res) {
  try {
    const { id } = req.params;
    const deleted = await RecruitmentPipeline.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Pipeline entry not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting pipeline entry:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete pipeline entry.' });
  }
}

module.exports = {
  listPipeline,
  createPipelineEntry,
  updatePipelineEntry,
  deletePipelineEntry,
};

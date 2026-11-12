const {
  JoiningTracker,
  JOINING_STATUSES,
} = require('../model/JoiningTracker');
const { CandidateMaster } = require('../model/CandidateMaster');
const { OfferTracker } = require('../model/OfferTracker');
const { ManpowerRequisition } = require('../model/ManpowerRequisition');

async function listJoinings(req, res) {
  try {
    const { centre, joiningStatus, search } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (joiningStatus && joiningStatus !== 'all') {
      filter.joiningStatus = joiningStatus;
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
        { employeeId: regex },
        { reportingManager: regex },
        { remarks: regex },
      ];
    }

    const docs = await JoiningTracker.find(filter)
      .populate('candidateId', 'candidateId candidateName mobile centre designation recruiter requisitionId')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = docs.map((doc) => {
      // Delay (Days) = Actual DOJ - Expected DOJ
      let delayDays = '-';
      if (doc.expectedDoj && doc.actualDoj) {
        const exp = new Date(doc.expectedDoj);
        const act = new Date(doc.actualDoj);
        const diffMs = act - exp;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        delayDays = days > 0 ? `+${days} d` : `${days} d`;
      } else if (doc.expectedDoj && !doc.actualDoj) {
        const now = new Date();
        const exp = new Date(doc.expectedDoj);
        if (now > exp) {
          const diffMs = now - exp;
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          delayDays = days > 0 ? `+${days} d (Pending)` : '-';
        }
      }

      return {
        ...doc,
        delayDays,
      };
    });

    return res.status(200).json({
      ok: true,
      data: enriched,
      meta: {
        joiningStatuses: JOINING_STATUSES,
      },
    });
  } catch (error) {
    console.error('Error listing joining tracker:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load joining records.' });
  }
}

async function createJoining(req, res) {
  try {
    const {
      candidateId,
      actualDoj,
      joiningStatus,
      employeeId,
      reportingManager,
      remarks,
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({ ok: false, error: 'Candidate is required.' });
    }

    const candidateDoc = await CandidateMaster.findById(candidateId).lean();
    if (!candidateDoc) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    // Lookup expectedDoj from OfferTracker
    const offerDoc = await OfferTracker.findOne({ candidateId: candidateDoc._id })
      .sort({ createdAt: -1 })
      .lean();

    const expectedDoj = offerDoc?.expectedDoj || null;

    const newJoining = new JoiningTracker({
      candidateId: candidateDoc._id,
      candidateIdStr: candidateDoc.candidateId || '',
      candidateName: candidateDoc.candidateName,
      company: candidateDoc.company || 'Seeds of Innocence',
      centre: candidateDoc.centre || '',
      designation: candidateDoc.designation || '',
      recruiter: candidateDoc.recruiter || '',
      expectedDoj,
      actualDoj: actualDoj ? new Date(actualDoj) : null,
      joiningStatus: joiningStatus || (actualDoj ? 'Joined' : 'Pending Joining'),
      employeeId: employeeId?.trim() || '',
      reportingManager: reportingManager?.trim() || '',
      remarks: remarks?.trim() || '',
      createdBy: req.user?._id || null,
    });

    await newJoining.save();

    // If status is 'Joined', update CandidateMaster & ManpowerRequisition vacancy counts
    if (newJoining.joiningStatus === 'Joined') {
      await CandidateMaster.findByIdAndUpdate(candidateDoc._id, {
        currentStage: 'Joined',
        pipelineStatus: 'Joined',
      });

      if (candidateDoc.requisitionId) {
        const reqDoc = await ManpowerRequisition.findById(candidateDoc.requisitionId);
        if (reqDoc) {
          const newFilled = (reqDoc.filled || 0) + 1;
          const newOpen = Math.max(0, (reqDoc.positionsRequired || 1) - newFilled);
          const newStatus = newOpen === 0 ? 'Closed' : reqDoc.requisitionStatus;
          await ManpowerRequisition.findByIdAndUpdate(reqDoc._id, {
            filled: newFilled,
            open: newOpen,
            requisitionStatus: newStatus,
          });
        }
      }
    }

    return res.status(201).json({ ok: true, data: newJoining });
  } catch (error) {
    console.error('Error creating joining:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to record joining.' });
  }
}

async function updateJoining(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.actualDoj) body.actualDoj = new Date(body.actualDoj);

    const existing = await JoiningTracker.findById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Joining record not found.' });
    }

    const prevStatus = existing.joiningStatus;

    const updated = await JoiningTracker.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    // If status became 'Joined'
    if (updated.joiningStatus === 'Joined' && prevStatus !== 'Joined') {
      await CandidateMaster.findByIdAndUpdate(updated.candidateId, {
        currentStage: 'Joined',
        pipelineStatus: 'Joined',
      });

      const candidateDoc = await CandidateMaster.findById(updated.candidateId).lean();
      if (candidateDoc && candidateDoc.requisitionId) {
        const reqDoc = await ManpowerRequisition.findById(candidateDoc.requisitionId);
        if (reqDoc) {
          const newFilled = (reqDoc.filled || 0) + 1;
          const newOpen = Math.max(0, (reqDoc.positionsRequired || 1) - newFilled);
          const newStatus = newOpen === 0 ? 'Closed' : reqDoc.requisitionStatus;
          await ManpowerRequisition.findByIdAndUpdate(reqDoc._id, {
            filled: newFilled,
            open: newOpen,
            requisitionStatus: newStatus,
          });
        }
      }
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating joining record:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update joining record.' });
  }
}

async function deleteJoining(req, res) {
  try {
    const { id } = req.params;
    const deleted = await JoiningTracker.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Joining record not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting joining record:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete joining record.' });
  }
}

module.exports = {
  listJoinings,
  createJoining,
  updateJoining,
  deleteJoining,
};

const {
  OnboardingChecklist,
  CHECKLIST_ITEMS,
  calculateCompletion,
} = require('../model/OnboardingChecklist');
const { CandidateMaster } = require('../model/CandidateMaster');
const { JoiningTracker } = require('../model/JoiningTracker');

async function listChecklists(req, res) {
  try {
    const { centre, onboardingStatus, search } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (onboardingStatus && onboardingStatus !== 'all') {
      filter.onboardingStatus = onboardingStatus;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { candidateIdStr: regex },
        { candidateName: regex },
        { company: regex },
        { centre: regex },
        { remarks: regex },
      ];
    }

    const docs = await OnboardingChecklist.find(filter)
      .populate('candidateId', 'candidateId candidateName mobile centre designation')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ ok: true, data: docs });
  } catch (error) {
    console.error('Error listing onboarding checklists:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load checklists.' });
  }
}

async function createChecklist(req, res) {
  try {
    const { candidateId, remarks, ...items } = req.body;

    if (!candidateId) {
      return res.status(400).json({ ok: false, error: 'Candidate is required.' });
    }

    const candidateDoc = await CandidateMaster.findById(candidateId).lean();
    if (!candidateDoc) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    // Actual DOJ from JoiningTracker if exists
    const joiningDoc = await JoiningTracker.findOne({ candidateId: candidateDoc._id })
      .sort({ createdAt: -1 })
      .lean();

    const actualDoj = joiningDoc?.actualDoj || null;

    const checklistData = {
      candidateId: candidateDoc._id,
      candidateIdStr: candidateDoc.candidateId || '',
      candidateName: candidateDoc.candidateName,
      company: candidateDoc.company || 'Seeds of Innocence',
      centre: candidateDoc.centre || '',
      actualDoj,
      remarks: remarks?.trim() || '',
      createdBy: req.user?._id || null,
    };

    CHECKLIST_ITEMS.forEach((key) => {
      const itemVal = items[key];
      if (typeof itemVal === 'object' && itemVal !== null) {
        checklistData[key] = {
          status: itemVal.status || 'Pending',
          notApplicable: Boolean(itemVal.notApplicable),
        };
      } else if (typeof itemVal === 'boolean') {
        checklistData[key] = {
          status: itemVal ? 'Yes' : 'Pending',
          notApplicable: false,
        };
      } else {
        checklistData[key] = { status: 'Pending', notApplicable: false };
      }
    });

    const newDoc = new OnboardingChecklist(checklistData);
    await newDoc.save();

    return res.status(201).json({ ok: true, data: newDoc });
  } catch (error) {
    console.error('Error creating checklist:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to create checklist.' });
  }
}

async function updateChecklist(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    const existing = await OnboardingChecklist.findById(id);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Checklist not found.' });
    }

    if (body.remarks !== undefined) existing.remarks = body.remarks;

    CHECKLIST_ITEMS.forEach((key) => {
      if (body[key] !== undefined) {
        const itemVal = body[key];
        if (typeof itemVal === 'object' && itemVal !== null) {
          existing[key] = {
            status: itemVal.status || 'Pending',
            notApplicable: Boolean(itemVal.notApplicable),
          };
        } else if (typeof itemVal === 'boolean') {
          existing[key] = {
            status: itemVal ? 'Yes' : 'Pending',
            notApplicable: false,
          };
        }
      }
    });

    calculateCompletion(existing);
    await existing.save();

    return res.status(200).json({ ok: true, data: existing });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update checklist.' });
  }
}

async function deleteChecklist(req, res) {
  try {
    const { id } = req.params;
    const deleted = await OnboardingChecklist.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Checklist not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete checklist.' });
  }
}

module.exports = {
  listChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
};

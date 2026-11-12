const {
  ManpowerRequisition,
  DEPARTMENTS,
  DEPARTMENT_DESIGNATIONS,
} = require('../model/ManpowerRequisition');

async function listRequisitions(req, res) {
  try {
    const { centre, department, approvalStatus, requisitionStatus, search } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (department && department !== 'all') {
      filter.department = department;
    }
    if (approvalStatus && approvalStatus !== 'all') {
      filter.approvalStatus = approvalStatus;
    }
    if (requisitionStatus && requisitionStatus !== 'all') {
      filter.requisitionStatus = requisitionStatus;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { reqId: regex },
        { company: regex },
        { centre: regex },
        { department: regex },
        { designation: regex },
        { requestedBy: regex },
        { recruiterAssigned: regex },
        { remarks: regex },
      ];
    }

    const docs = await ManpowerRequisition.find(filter).sort({ createdAt: -1 }).lean();

    // Calculate ageing in days
    const now = new Date();
    const enriched = docs.map((doc) => {
      const raised = doc.dateRaised ? new Date(doc.dateRaised) : new Date(doc.createdAt);
      const diffMs = Math.max(0, now - raised);
      const ageingDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        ...doc,
        ageingDays,
      };
    });

    return res.status(200).json({
      ok: true,
      data: enriched,
      meta: {
        departments: DEPARTMENTS,
        departmentDesignations: DEPARTMENT_DESIGNATIONS,
      },
    });
  } catch (error) {
    console.error('Error listing requisitions:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load requisitions.' });
  }
}

async function getNextReqId(req, res) {
  try {
    const lastDoc = await ManpowerRequisition.findOne({}, { reqId: 1 })
      .sort({ createdAt: -1 })
      .lean();
    let nextNum = 1;
    if (lastDoc && lastDoc.reqId) {
      const match = lastDoc.reqId.match(/REQ-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const nextReqId = `REQ-${String(nextNum).padStart(4, '0')}`;
    return res.status(200).json({ ok: true, data: { nextReqId } });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Failed to generate Req ID' });
  }
}

async function createRequisition(req, res) {
  try {
    const {
      company,
      dateRaised,
      centre,
      department,
      designation,
      hiringType,
      positionsRequired,
      priority,
      requestedBy,
      approvalStatus,
      approvalDate,
      recruiterAssigned,
      targetClosure,
      remarks,
    } = req.body;

    if (!centre || !department || !designation) {
      return res.status(400).json({
        ok: false,
        error: 'Centre, Department, and Designation are required.',
      });
    }

    const positions = Math.max(1, parseInt(positionsRequired, 10) || 1);

    const newReq = new ManpowerRequisition({
      company: company || 'Seeds of Innocence',
      dateRaised: dateRaised ? new Date(dateRaised) : new Date(),
      centre: centre.trim(),
      department: department.trim(),
      designation: designation.trim(),
      hiringType: hiringType || 'New Vacancy',
      positionsRequired: positions,
      open: positions,
      filled: 0,
      priority: priority || 'Medium',
      requestedBy: requestedBy?.trim() || '',
      approvalStatus: approvalStatus || 'Pending',
      approvalDate: approvalDate ? new Date(approvalDate) : null,
      recruiterAssigned: recruiterAssigned?.trim() || '',
      targetClosure: targetClosure ? new Date(targetClosure) : null,
      requisitionStatus: 'Open',
      remarks: remarks?.trim() || '',
      createdBy: req.user?._id || null,
    });

    await newReq.save();
    return res.status(201).json({ ok: true, data: newReq });
  } catch (error) {
    console.error('Error creating requisition:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to create requisition.' });
  }
}

async function updateRequisition(req, res) {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    if (body.positionsRequired !== undefined) {
      body.positionsRequired = Math.max(1, parseInt(body.positionsRequired, 10) || 1);
      const existing = await ManpowerRequisition.findById(id);
      if (existing) {
        const filled = existing.filled || 0;
        body.open = Math.max(0, body.positionsRequired - filled);
      }
    }

    const updated = await ManpowerRequisition.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Requisition not found.' });
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating requisition:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update requisition.' });
  }
}

async function deleteRequisition(req, res) {
  try {
    const { id } = req.params;
    const deleted = await ManpowerRequisition.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Requisition not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting requisition:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete requisition.' });
  }
}

module.exports = {
  listRequisitions,
  getNextReqId,
  createRequisition,
  updateRequisition,
  deleteRequisition,
};

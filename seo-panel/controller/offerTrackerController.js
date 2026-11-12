const {
  OfferTracker,
  OFFER_APPROVAL_STATUSES,
  OFFER_STATUSES,
} = require('../model/OfferTracker');
const { CandidateMaster } = require('../model/CandidateMaster');

async function listOffers(req, res) {
  try {
    const { centre, approvalStatus, offerStatus, search } = req.query;
    const filter = {};

    if (centre && centre !== 'All centres' && centre !== 'all') {
      filter.centre = centre;
    }
    if (approvalStatus && approvalStatus !== 'all') {
      filter.approvalStatus = approvalStatus;
    }
    if (offerStatus && offerStatus !== 'all') {
      filter.offerStatus = offerStatus;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { candidateIdStr: regex },
        { candidateName: regex },
        { company: regex },
        { centre: regex },
        { designation: regex },
        { remarks: regex },
      ];
    }

    const docs = await OfferTracker.find(filter)
      .populate('candidateId', 'candidateId candidateName mobile expectedCtcLakh centre designation')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    const enriched = docs.map((doc) => {
      // CTC Gap = Offered CTC - Expected CTC
      const exp = parseFloat(doc.expectedCtcLakh) || 0;
      const off = parseFloat(doc.offeredCtcLakh) || 0;
      const ctcGapVal = off - exp;
      const ctcGap = (off || exp) ? (ctcGapVal >= 0 ? `+${ctcGapVal.toFixed(2)}` : `${ctcGapVal.toFixed(2)}`) : '-';

      // Offer TAT (Days) = Offer Release Date - Offer Request Date (or now - reqDate)
      let tatDays = '-';
      if (doc.offerRequestDate) {
        const reqDate = new Date(doc.offerRequestDate);
        const endDate = doc.offerReleaseDate ? new Date(doc.offerReleaseDate) : now;
        const diffMs = Math.max(0, endDate - reqDate);
        tatDays = `${Math.floor(diffMs / (1000 * 60 * 60 * 24))} d`;
      }

      return {
        ...doc,
        ctcGap,
        offerTatDays: tatDays,
      };
    });

    return res.status(200).json({
      ok: true,
      data: enriched,
      meta: {
        approvalStatuses: OFFER_APPROVAL_STATUSES,
        offerStatuses: OFFER_STATUSES,
      },
    });
  } catch (error) {
    console.error('Error listing offer tracker:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load offer records.' });
  }
}

async function createOffer(req, res) {
  try {
    const {
      candidateId,
      offeredCtcLakh,
      offerRequestDate,
      approvalStatus,
      approvalDate,
      offerReleaseDate,
      offerStatus,
      responseDate,
      expectedDoj,
      remarks,
    } = req.body;

    if (!candidateId) {
      return res.status(400).json({ ok: false, error: 'Candidate is required.' });
    }

    const candidateDoc = await CandidateMaster.findById(candidateId).lean();
    if (!candidateDoc) {
      return res.status(404).json({ ok: false, error: 'Candidate not found.' });
    }

    const newOffer = new OfferTracker({
      candidateId: candidateDoc._id,
      candidateIdStr: candidateDoc.candidateId || '',
      candidateName: candidateDoc.candidateName,
      company: candidateDoc.company || 'Seeds of Innocence',
      centre: candidateDoc.centre || '',
      designation: candidateDoc.designation || '',
      expectedCtcLakh: candidateDoc.expectedCtcLakh || '',
      offeredCtcLakh: offeredCtcLakh?.trim() || '',
      offerRequestDate: offerRequestDate ? new Date(offerRequestDate) : new Date(),
      approvalStatus: approvalStatus || 'Pending',
      approvalDate: approvalDate ? new Date(approvalDate) : null,
      offerReleaseDate: offerReleaseDate ? new Date(offerReleaseDate) : null,
      offerStatus: offerStatus || 'Offer Released',
      responseDate: responseDate ? new Date(responseDate) : null,
      expectedDoj: expectedDoj ? new Date(expectedDoj) : null,
      remarks: remarks?.trim() || '',
      createdBy: req.user?._id || null,
    });

    await newOffer.save();

    // Update candidate stage if offer released
    await CandidateMaster.findByIdAndUpdate(candidateDoc._id, {
      currentStage: 'Offer Stage',
      pipelineStatus: 'Offer Released',
    });

    return res.status(201).json({ ok: true, data: newOffer });
  } catch (error) {
    console.error('Error creating offer:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to create offer entry.' });
  }
}

async function updateOffer(req, res) {
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
        body.expectedCtcLakh = candidateDoc.expectedCtcLakh || '';
      }
    }

    if (body.offerRequestDate) body.offerRequestDate = new Date(body.offerRequestDate);
    if (body.approvalDate) body.approvalDate = new Date(body.approvalDate);
    if (body.offerReleaseDate) body.offerReleaseDate = new Date(body.offerReleaseDate);
    if (body.responseDate) body.responseDate = new Date(body.responseDate);
    if (body.expectedDoj) body.expectedDoj = new Date(body.expectedDoj);

    const updated = await OfferTracker.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Offer record not found.' });
    }

    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    console.error('Error updating offer record:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to update offer record.' });
  }
}

async function deleteOffer(req, res) {
  try {
    const { id } = req.params;
    const deleted = await OfferTracker.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Offer record not found.' });
    }
    return res.status(200).json({ ok: true, data: { id } });
  } catch (error) {
    console.error('Error deleting offer record:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete offer record.' });
  }
}

module.exports = {
  listOffers,
  createOffer,
  updateOffer,
  deleteOffer,
};

const { ManpowerRequisition } = require('../model/ManpowerRequisition');
const { CandidateMaster } = require('../model/CandidateMaster');
const { InterviewTracker } = require('../model/InterviewTracker');
const { OfferTracker } = require('../model/OfferTracker');
const { JoiningTracker } = require('../model/JoiningTracker');
const { OnboardingChecklist } = require('../model/OnboardingChecklist');
const { RecruitmentFollowUp } = require('../model/RecruitmentFollowUp');
const { HrMasterSetting } = require('../model/MasterSettings');

function clean(str) {
  return String(str || '').trim().toLowerCase();
}

async function getMisReport(req, res) {
  try {
    const { from, to } = req.query;

    let startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    let endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const rangeFilter = { createdAt: { $gte: startDate, $lte: endDate } };
    const dateRaisedFilter = { dateRaised: { $gte: startDate, $lte: endDate } };

    // Get dynamic centres & departments from MasterSettings
    let centresList = [];
    let deptsList = [];

    try {
      const settings = await HrMasterSetting.findOne().lean();
      if (settings?.dropdowns) {
        const dd = settings.dropdowns;
        const cItems = dd instanceof Map ? dd.get('centres') : dd['centres'];
        if (Array.isArray(cItems)) {
          centresList = cItems.map((c) => (typeof c === 'string' ? c.trim() : c.value?.trim())).filter(Boolean);
        }
        const dItems = dd instanceof Map ? dd.get('departments') : dd['departments'];
        if (Array.isArray(dItems)) {
          deptsList = dItems.map((d) => (typeof d === 'string' ? d.trim() : d.value?.trim())).filter(Boolean);
        }
      }
    } catch {}

    // 1. Fetch Requisitions
    const allRequisitions = await ManpowerRequisition.find().lean();
    const reqsInRange = await ManpowerRequisition.find({
      $or: [rangeFilter, dateRaisedFilter],
    }).lean();

    // 2. Fetch Candidates
    const candidatesInRange = await CandidateMaster.find(rangeFilter).lean();
    const allCandidates = await CandidateMaster.find().lean();

    // 3. Fetch Interviews
    const interviewsInRange = await InterviewTracker.find(rangeFilter).lean();

    // 4. Fetch Offers
    const offersInRange = await OfferTracker.find(rangeFilter).lean();

    // 5. Fetch Joinings
    const joiningsInRange = await JoiningTracker.find(rangeFilter).lean();
    const allJoinings = await JoiningTracker.find().lean();

    let positionsRaisedInRange = 0;
    reqsInRange.forEach((r) => {
      positionsRaisedInRange += Number(r.positionsRequired || 1);
    });

    const summaryCards = {
      positionsRaised: positionsRaisedInRange,
      candidatesRegistered: candidatesInRange.length,
      interviewsDone: interviewsInRange.length,
      offersReleased: offersInRange.filter((o) => o.status === 'Offer Released' || o.offerLetterSent).length,
      joined: joiningsInRange.filter((j) => j.status === 'Joined').length,
    };

    // --- TABLE A: CENTRE-WISE REPORT ---
    // Include master configured centres + any centre from real database records
    const centreSet = new Set(centresList);
    allRequisitions.forEach((r) => r.centre && centreSet.add(r.centre.trim()));
    allCandidates.forEach((c) => c.centre && centreSet.add(c.centre.trim()));

    const centreWiseRows = [];
    const totalCentre = {
      positionsApprovedAllTime: 0,
      openPositions: 0,
      candidatesRegisteredRange: 0,
      interviewsDoneRange: 0,
      offersReleasedRange: 0,
      joinedRange: 0,
      joinedAllTime: 0,
    };

    Array.from(centreSet).forEach((centreName) => {
      const cLower = clean(centreName);

      const centreReqs = allRequisitions.filter((r) => clean(r.centre) === cLower);
      let posApprovedAllTime = 0;
      let openPos = 0;
      centreReqs.forEach((r) => {
        if (r.approvalStatus === 'Approved') {
          posApprovedAllTime += Number(r.positionsRequired || 1);
        }
        if (r.requisitionStatus === 'Open') {
          openPos += Number(r.open !== undefined ? r.open : r.positionsRequired || 1);
        }
      });

      const candsRange = candidatesInRange.filter((c) => clean(c.centre) === cLower).length;

      const centreCandIds = new Set(
        allCandidates.filter((c) => clean(c.centre) === cLower).map((c) => String(c._id))
      );

      const interviewsRange = interviewsInRange.filter(
        (i) => clean(i.centre) === cLower || (i.candidateId && centreCandIds.has(String(i.candidateId)))
      ).length;

      const offersRange = offersInRange.filter(
        (o) =>
          (o.status === 'Offer Released' || o.offerLetterSent) &&
          (clean(o.centre) === cLower || (o.candidateId && centreCandIds.has(String(o.candidateId))))
      ).length;

      const joinedRange = joiningsInRange.filter(
        (j) =>
          j.status === 'Joined' &&
          (clean(j.centre) === cLower || (j.candidateId && centreCandIds.has(String(j.candidateId))))
      ).length;

      const joinedAllTime = allJoinings.filter(
        (j) =>
          j.status === 'Joined' &&
          (clean(j.centre) === cLower || (j.candidateId && centreCandIds.has(String(j.candidateId))))
      ).length;

      centreWiseRows.push({
        centre: centreName,
        positionsApprovedAllTime: posApprovedAllTime,
        openPositions: openPos,
        candidatesRegisteredRange: candsRange,
        interviewsDoneRange: interviewsRange,
        offersReleasedRange: offersRange,
        joinedRange,
        joinedAllTime,
      });

      totalCentre.positionsApprovedAllTime += posApprovedAllTime;
      totalCentre.openPositions += openPos;
      totalCentre.candidatesRegisteredRange += candsRange;
      totalCentre.interviewsDoneRange += interviewsRange;
      totalCentre.offersReleasedRange += offersRange;
      totalCentre.joinedRange += joinedRange;
      totalCentre.joinedAllTime += joinedAllTime;
    });

    // --- TABLE B: DEPARTMENT-WISE REPORT ---
    const deptSet = new Set(deptsList);
    allRequisitions.forEach((r) => r.department && deptSet.add(r.department.trim()));
    allCandidates.forEach((c) => c.department && deptSet.add(c.department.trim()));

    const departmentWiseRows = [];
    const totalDept = {
      positionsApprovedAllTime: 0,
      openPositions: 0,
      candidatesRegisteredRange: 0,
      interviewsDoneRange: 0,
      offersReleasedRange: 0,
      joinedRange: 0,
      joinedAllTime: 0,
    };

    Array.from(deptSet).forEach((deptName) => {
      const dLower = clean(deptName);

      const deptReqs = allRequisitions.filter((r) => clean(r.department) === dLower);
      let posApprovedAllTime = 0;
      let openPos = 0;
      deptReqs.forEach((r) => {
        if (r.approvalStatus === 'Approved') {
          posApprovedAllTime += Number(r.positionsRequired || 1);
        }
        if (r.requisitionStatus === 'Open') {
          openPos += Number(r.open !== undefined ? r.open : r.positionsRequired || 1);
        }
      });

      const candsRange = candidatesInRange.filter((c) => clean(c.department) === dLower).length;

      const deptCandIds = new Set(
        allCandidates.filter((c) => clean(c.department) === dLower).map((c) => String(c._id))
      );

      const interviewsRange = interviewsInRange.filter(
        (i) => clean(i.department) === dLower || (i.candidateId && deptCandIds.has(String(i.candidateId)))
      ).length;

      const offersRange = offersInRange.filter(
        (o) =>
          (o.status === 'Offer Released' || o.offerLetterSent) &&
          (clean(o.department) === dLower || (o.candidateId && deptCandIds.has(String(o.candidateId))))
      ).length;

      const joinedRange = joiningsInRange.filter(
        (j) =>
          j.status === 'Joined' &&
          (clean(j.department) === dLower || (j.candidateId && deptCandIds.has(String(j.candidateId))))
      ).length;

      const joinedAllTime = allJoinings.filter(
        (j) =>
          j.status === 'Joined' &&
          (clean(j.department) === dLower || (j.candidateId && deptCandIds.has(String(j.candidateId))))
      ).length;

      departmentWiseRows.push({
        department: deptName,
        positionsApprovedAllTime: posApprovedAllTime,
        openPositions: openPos,
        candidatesRegisteredRange: candsRange,
        interviewsDoneRange: interviewsRange,
        offersReleasedRange: offersRange,
        joinedRange,
        joinedAllTime,
      });

      totalDept.positionsApprovedAllTime += posApprovedAllTime;
      totalDept.openPositions += openPos;
      totalDept.candidatesRegisteredRange += candsRange;
      totalDept.interviewsDoneRange += interviewsRange;
      totalDept.offersReleasedRange += offersRange;
      totalDept.joinedRange += joinedRange;
      totalDept.joinedAllTime += joinedAllTime;
    });

    // --- TABLE C: MONTH-WISE TREND ---
    const monthWiseRows = [];
    const totalTrend = {
      positionsRaised: 0,
      candidatesRegistered: 0,
      interviewsDone: 0,
      offersReleased: 0,
      joined: 0,
    };

    const currentCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    while (currentCursor <= endCursor) {
      const year = currentCursor.getFullYear();
      const monthIdx = currentCursor.getMonth();
      const monthLabel = `${monthNames[monthIdx]}-${year}`;

      const mStart = new Date(year, monthIdx, 1);
      const mEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);

      let mPositions = 0;
      allRequisitions.forEach((r) => {
        const d = new Date(r.dateRaised || r.createdAt);
        if (d >= mStart && d <= mEnd) {
          mPositions += Number(r.positionsRequired || 1);
        }
      });

      const mCands = allCandidates.filter((c) => {
        const d = new Date(c.createdAt || c.dateAdded);
        return d >= mStart && d <= mEnd;
      }).length;

      const mInterviews = (await InterviewTracker.find({ createdAt: { $gte: mStart, $lte: mEnd } }).lean()).length;

      const mOffers = (await OfferTracker.find({
        createdAt: { $gte: mStart, $lte: mEnd },
        status: { $in: ['Offer Released', 'Accepted', 'Joined'] },
      }).lean()).length;

      const mJoined = (await JoiningTracker.find({
        createdAt: { $gte: mStart, $lte: mEnd },
        status: 'Joined',
      }).lean()).length;

      monthWiseRows.push({
        month: monthLabel,
        positionsRaised: mPositions,
        candidatesRegistered: mCands,
        interviewsDone: mInterviews,
        offersReleased: mOffers,
        joined: mJoined,
      });

      totalTrend.positionsRaised += mPositions;
      totalTrend.candidatesRegistered += mCands;
      totalTrend.interviewsDone += mInterviews;
      totalTrend.offersReleased += mOffers;
      totalTrend.joined += mJoined;

      currentCursor.setMonth(currentCursor.getMonth() + 1);
    }

    return res.json({
      ok: true,
      data: {
        summaryCards,
        centreWiseRows,
        totalCentre,
        departmentWiseRows,
        totalDept,
        monthWiseRows,
        totalTrend,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Full candidate dump for Excel / CSV download
async function downloadMisData(req, res) {
  try {
    const { from, to, dateBasis = 'profile', dataset = 'candidates' } = req.query;

    let startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    let endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const candidates = await CandidateMaster.find(dateFilter)
      .populate('requisitionId')
      .lean();

    const candIds = candidates.map((c) => c._id);

    const [interviews, offers, joinings, onboardings, followups] = await Promise.all([
      InterviewTracker.find({ candidateId: { $in: candIds } }).lean(),
      OfferTracker.find({ candidateId: { $in: candIds } }).lean(),
      JoiningTracker.find({ candidateId: { $in: candIds } }).lean(),
      OnboardingChecklist.find({ candidateId: { $in: candIds } }).lean(),
      RecruitmentFollowUp.find({ candidateId: { $in: candIds } }).lean(),
    ]);

    const exportRows = candidates.map((can) => {
      const canIdStr = String(can._id);
      const candInterviews = interviews.filter((i) => String(i.candidateId) === canIdStr);
      const candOffer = offers.find((o) => String(o.candidateId) === canIdStr);
      const candJoining = joinings.find((j) => String(j.candidateId) === canIdStr);
      const candOnboarding = onboardings.find((ob) => String(ob.candidateId) === canIdStr);
      const candFollowups = followups.filter((f) => String(f.candidateId) === canIdStr);

      return {
        candidateId: can.candidateId || '',
        candidateName: can.candidateName || '',
        mobile: can.mobile || '',
        email: can.email || '',
        company: can.company || 'Seeds of Innocence',
        centre: can.centre || '',
        department: can.department || '',
        designation: can.designation || '',
        source: can.source || '',
        recruiter: can.recruiter || '',
        dateAdded: can.dateAdded ? new Date(can.dateAdded).toISOString().split('T')[0] : '',
        totalExpYrs: can.totalExpYrs || '',
        currentCtcLakh: can.currentCtcLakh || '',
        expectedCtcLakh: can.expectedCtcLakh || '',
        currentLocation: can.currentLocation || '',
        totalInterviewRounds: candInterviews.length,
        latestInterviewStatus: candInterviews[candInterviews.length - 1]?.status || '',
        latestInterviewResult: candInterviews[candInterviews.length - 1]?.result || '',
        offerStatus: candOffer?.status || 'No Offer',
        offeredCtcLakh: candOffer?.offeredCtcLakh || '',
        joiningStatus: candJoining?.status || 'Not Joined',
        actualJoiningDate: candJoining?.actualJoiningDate
          ? new Date(candJoining.actualJoiningDate).toISOString().split('T')[0]
          : '',
        employeeId: candJoining?.employeeId || '',
        onboardingCompletedTasks: candOnboarding?.tasks?.filter((t) => t.completed)?.length || 0,
        totalFollowUps: candFollowups.length,
        remarks: can.remarks || '',
      };
    });

    return res.json({ ok: true, data: exportRows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getMisReport,
  downloadMisData,
};

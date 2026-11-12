const { CandidateMaster } = require('../model/CandidateMaster');
const { InterviewTracker } = require('../model/InterviewTracker');
const { OfferTracker } = require('../model/OfferTracker');
const { JoiningTracker } = require('../model/JoiningTracker');
const { RecruitmentPipeline } = require('../model/RecruitmentPipeline');
const { HrMasterSetting } = require('../model/MasterSettings');
const SeoUser = require('../model/SeoUser');

// GET /api/performance-reports?recruiter=...&from=...&to=...
async function getPerformanceReport(req, res) {
  try {
    const { recruiter = 'All recruiters', from, to } = req.query;

    // Date range
    let startDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    let endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);

    const dateFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    // 1. Fetch Candidates in range
    const candFilter = { ...dateFilter };
    if (recruiter && recruiter !== 'All recruiters') {
      candFilter.recruiter = recruiter;
    }
    const candidates = await CandidateMaster.find(candFilter).lean();

    // 2. Fetch Interviews done in range
    const interviewFilter = { ...dateFilter };
    if (recruiter && recruiter !== 'All recruiters') {
      interviewFilter.recruiter = recruiter;
    }
    const interviews = await InterviewTracker.find(interviewFilter).lean();

    // 3. Fetch Offers in range
    const offers = await OfferTracker.find(dateFilter).populate('candidateId', 'recruiter source').lean();

    // 4. Fetch Joinings in range
    const joinings = await JoiningTracker.find(dateFilter).populate('candidateId', 'recruiter source').lean();

    // 5. Fetch Active in Pipeline
    const pipelineActive = await RecruitmentPipeline.find({
      stageStatus: 'Active',
      pipelineStatus: { $ne: 'Closed' },
    }).lean();

    // 6. Dynamically get configured sources and recruiters from MasterSettings
    let configuredSources = [];
    let configuredRecruiters = [];

    try {
      const settings = await HrMasterSetting.findOne().lean();
      if (settings?.dropdowns) {
        const dd = settings.dropdowns;
        const srcItems = dd instanceof Map ? dd.get('sources') : dd['sources'];
        if (Array.isArray(srcItems)) {
          configuredSources = srcItems.map((s) => (typeof s === 'string' ? s.trim() : s.value?.trim())).filter(Boolean);
        }
        const recItems = dd instanceof Map ? dd.get('recruiters') : dd['recruiters'];
        if (Array.isArray(recItems)) {
          configuredRecruiters = recItems.map((r) => (typeof r === 'string' ? { name: r.trim(), target: 0 } : { name: r.value?.trim(), target: Number(r.extra) || 0 })).filter((r) => r.name);
        }
      }
    } catch {}

    // Include any distinct sources present in CandidateMaster records
    const candSources = await CandidateMaster.distinct('source');
    candSources.forEach((s) => {
      if (s && s.trim() && !configuredSources.includes(s.trim())) {
        configuredSources.push(s.trim());
      }
    });

    // HR user recruiters
    const hrUsers = await SeoUser.find({
      role: 'hr',
      email: { $ne: 'amitkumaryadav8314@gmail.com' },
      loginId: { $ne: 'admin' },
    }).lean();

    const distinctCandRecruiters = await CandidateMaster.distinct('recruiter');
    const combinedRecruiterSet = new Set(configuredRecruiters.map((r) => r.name));
    hrUsers.forEach((u) => {
      const name = (u.name || u.loginId || '').trim();
      if (name) combinedRecruiterSet.add(name);
    });
    distinctCandRecruiters.forEach((r) => {
      if (r && r.trim()) combinedRecruiterSet.add(r.trim());
    });

    const recruiterList = Array.from(combinedRecruiterSet);

    // --- A. SOURCE-WISE AGGREGATION ---
    const sourceBuckets = {};
    configuredSources.forEach((s) => {
      sourceBuckets[s] = {
        source: s,
        registered: 0,
        interviewsDone: 0,
        offersReleased: 0,
        offersAccepted: 0,
        joined: 0,
        candidateIds: [],
      };
    });

    const candidateSourceMap = new Map();
    candidates.forEach((c) => {
      const src = (c.source || 'Other').trim();
      candidateSourceMap.set(String(c._id), src);
      if (!sourceBuckets[src]) {
        sourceBuckets[src] = {
          source: src,
          registered: 0,
          interviewsDone: 0,
          offersReleased: 0,
          offersAccepted: 0,
          joined: 0,
          candidateIds: [],
        };
      }
      sourceBuckets[src].registered += 1;
      sourceBuckets[src].candidateIds.push(String(c._id));
    });

    interviews.forEach((inv) => {
      const cId = String(inv.candidateId || '');
      const src = candidateSourceMap.get(cId);
      if (src && sourceBuckets[src]) {
        sourceBuckets[src].interviewsDone += 1;
      }
    });

    offers.forEach((off) => {
      const src = off.candidateId?.source ? off.candidateId.source.trim() : null;
      if (src && sourceBuckets[src]) {
        sourceBuckets[src].offersReleased += 1;
        if (off.status === 'Accepted' || off.status === 'Joined') {
          sourceBuckets[src].offersAccepted += 1;
        }
      }
    });

    joinings.forEach((join) => {
      if (join.status === 'Joined') {
        const src = join.candidateId?.source ? join.candidateId.source.trim() : null;
        if (src && sourceBuckets[src]) {
          sourceBuckets[src].joined += 1;
        }
      }
    });

    const sourceWiseRows = Object.values(sourceBuckets).map((b) => {
      const regToJoin = b.registered > 0 ? Math.round((b.joined / b.registered) * 100) : 0;
      const offAccept = b.offersReleased > 0 ? Math.round((b.offersAccepted / b.offersReleased) * 100) : 0;
      return {
        ...b,
        registeredToJoinedPct: `${regToJoin}%`,
        offerAcceptancePct: `${offAccept}%`,
      };
    });

    // Summary of source totals
    const totalSource = {
      registered: sourceWiseRows.reduce((a, b) => a + b.registered, 0),
      interviewsDone: sourceWiseRows.reduce((a, b) => a + b.interviewsDone, 0),
      offersReleased: sourceWiseRows.reduce((a, b) => a + b.offersReleased, 0),
      offersAccepted: sourceWiseRows.reduce((a, b) => a + b.offersAccepted, 0),
      joined: sourceWiseRows.reduce((a, b) => a + b.joined, 0),
    };

    // --- B. RECRUITER-WISE PERFORMANCE AGGREGATION ---
    const diffTime = Math.abs(endDate - startDate);
    const daysInRange = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const recruiterWiseRows = recruiterList.map((recName) => {
      const conf = configuredRecruiters.find((r) => r.name.toLowerCase() === recName.toLowerCase());
      const monthlyTarget = conf ? conf.target : 0;
      const targetForRange = Math.round(((monthlyTarget * daysInRange) / 30.4) * 10) / 10;

      const reg = candidates.filter((c) => (c.recruiter || '').trim().toLowerCase() === recName.toLowerCase()).length;
      const invs = interviews.filter((i) => (i.recruiter || '').trim().toLowerCase() === recName.toLowerCase()).length;

      const offReleased = offers.filter(
        (o) => (o.recruiter || o.candidateId?.recruiter || '').trim().toLowerCase() === recName.toLowerCase()
      ).length;

      const offAccepted = offers.filter(
        (o) =>
          (o.status === 'Accepted' || o.status === 'Joined') &&
          (o.recruiter || o.candidateId?.recruiter || '').trim().toLowerCase() === recName.toLowerCase()
      ).length;

      const jnd = joinings.filter(
        (j) =>
          j.status === 'Joined' &&
          (j.recruiter || j.candidateId?.recruiter || '').trim().toLowerCase() === recName.toLowerCase()
      ).length;

      const activePipe = pipelineActive.filter(
        (p) => (p.recruiter || '').trim().toLowerCase() === recName.toLowerCase()
      ).length;

      const achievementPct =
        targetForRange > 0 ? `${Math.round((jnd / targetForRange) * 100)}%` : jnd > 0 ? '100%' : '0%';

      return {
        recruiter: recName,
        monthlyTarget,
        targetForRange,
        registered: reg,
        interviewsDone: invs,
        offersReleased: offReleased,
        offersAccepted: offAccepted,
        joined: jnd,
        achievementPct,
        activeInPipeline: activePipe,
      };
    });

    const totalRecruiter = {
      targetForRange: Math.round(recruiterWiseRows.reduce((a, b) => a + b.targetForRange, 0) * 10) / 10,
      registered: recruiterWiseRows.reduce((a, b) => a + b.registered, 0),
      interviewsDone: recruiterWiseRows.reduce((a, b) => a + b.interviewsDone, 0),
      offersReleased: recruiterWiseRows.reduce((a, b) => a + b.offersReleased, 0),
      offersAccepted: recruiterWiseRows.reduce((a, b) => a + b.offersAccepted, 0),
      joined: recruiterWiseRows.reduce((a, b) => a + b.joined, 0),
      activeInPipeline: recruiterWiseRows.reduce((a, b) => a + b.activeInPipeline, 0),
    };

    return res.json({
      ok: true,
      recruiterList,
      sourceWiseRows,
      totalSource,
      recruiterWiseRows,
      totalRecruiter,
      daysInRange,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getPerformanceReport,
};

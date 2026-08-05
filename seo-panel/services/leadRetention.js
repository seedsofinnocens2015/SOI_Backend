const Lead = require('../model/Lead');

const INDIA_OFFSET_MINUTES = 330;
const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

function getRetentionCutoff(now = new Date()) {
  const indiaTime = new Date(now.getTime() + INDIA_OFFSET_MINUTES * 60 * 1000);
  indiaTime.setUTCDate(indiaTime.getUTCDate() - RETENTION_DAYS);
  indiaTime.setUTCHours(0, 0, 0, 0);
  return new Date(indiaTime.getTime() - INDIA_OFFSET_MINUTES * 60 * 1000);
}

async function deleteExpiredLeads(now = new Date()) {
  const cutoff = getRetentionCutoff(now);
  const result = await Lead.deleteMany({ createdAt: { $lt: cutoff } });

  if (result.deletedCount > 0) {
    console.log(`Lead retention cleanup deleted ${result.deletedCount} expired lead(s).`);
  }

  return {
    cutoff,
    deletedCount: result.deletedCount || 0,
  };
}

function startLeadRetentionSchedule() {
  deleteExpiredLeads().catch((error) => {
    console.error('Initial lead retention cleanup failed:', error.message);
  });

  const timer = setInterval(() => {
    deleteExpiredLeads().catch((error) => {
      console.error('Scheduled lead retention cleanup failed:', error.message);
    });
  }, CLEANUP_INTERVAL_MS);

  timer.unref?.();
  return timer;
}

module.exports = {
  deleteExpiredLeads,
  getRetentionCutoff,
  startLeadRetentionSchedule,
};

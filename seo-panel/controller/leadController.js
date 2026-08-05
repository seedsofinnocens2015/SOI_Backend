const Lead = require('../model/Lead');

async function listLeads(req, res) {
  try {
    const leadType = String(req.query.type || '').trim();
    if (!['website', 'landing-page'].includes(leadType)) {
      return res.status(400).json({ ok: false, error: 'A valid lead type is required.' });
    }

    const leads = await Lead.find({ leadType }).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, data: leads });
  } catch (error) {
    console.error('Unable to list panel leads:', error.message);
    return res.status(500).json({ ok: false, error: 'Unable to load leads.' });
  }
}

module.exports = { listLeads };

const Lead = require('../seo-panel/model/Lead');
const LeadPhoneLock = require('../seo-panel/model/LeadPhoneLock');

const DUPLICATE_MESSAGE = 'This phone number has already been used to submit a form.';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const duplicateError = () => {
  const error = new Error(DUPLICATE_MESSAGE);
  error.status = 409;
  error.duplicate = true;
  return error;
};

async function reserveLeadPhone(phone, formType) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return;

  // Also cover leads that existed before phone locking was introduced.
  const existingLead = await Lead.exists({
    phone: { $regex: `${normalizedPhone}$` },
  });
  if (existingLead) throw duplicateError();

  try {
    // Wait for the unique index before accepting traffic so simultaneous
    // submissions with the same number cannot both pass.
    await LeadPhoneLock.init();
    await LeadPhoneLock.create({ phone: normalizedPhone, formType });
  } catch (error) {
    if (error?.code === 11000) throw duplicateError();
    throw error;
  }
}

module.exports = {
  DUPLICATE_MESSAGE,
  normalizePhone,
  reserveLeadPhone,
};

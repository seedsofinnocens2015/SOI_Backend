const axios = require('axios');
const nodemailer = require('nodemailer');

const cleanEnvValue = (value) => (value || '').split('#')[0].trim();

// SMTP / email config
const SMTP_HOST = cleanEnvValue(process.env.SMTP_HOST);
const SMTP_PORT = cleanEnvValue(process.env.SMTP_PORT);
const SMTP_USER = cleanEnvValue(process.env.SMTP_USER);
const SMTP_PASS = cleanEnvValue(process.env.SMTP_PASS);
const SMTP_SECURE = cleanEnvValue(process.env.SMTP_SECURE);
const SMTP_FROM = cleanEnvValue(process.env.SMTP_FROM);

// LeadSquared config
const LEADSQUARED_BASE_URL = cleanEnvValue(
  process.env.LSQ_BASE_URL || process.env.LEADSQUARED_BASE_URL || process.env.LEADSQUARED_DOMAIN || ''
);
const LEADSQUARED_ENDPOINT = cleanEnvValue(
  process.env.LSQ_ENDPOINT || process.env.LEADSQUARED_ENDPOINT || process.env.LEADSQUARED_URL || ''
);
const LEADSQUARED_ACCESS_KEY = cleanEnvValue(
  process.env.LSQ_ACCESS_KEY || process.env.LEADSQUARED_ACCESS_KEY || process.env.ACCESS_KEY
);
const LEADSQUARED_SECRET_KEY = cleanEnvValue(
  process.env.LSQ_SECRET_KEY || process.env.LEADSQUARED_SECRET_KEY || process.env.SECRET_KEY
);

const NOTIFICATION_EMAIL = cleanEnvValue(
  process.env.RECEIVER_EMAIL || process.env.NOTIFICATION_EMAIL || 'digital@seedsofinnocence.com'
);

const EMAIL_FROM =
  cleanEnvValue(process.env.EMAIL_FROM || SMTP_FROM) || `"SOI Website" <${SMTP_USER || 'no-reply@example.com'}>`;

let transporter;

const ensureTransporter = () => {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('⚠️  Email credentials are not fully configured, skipping mail delivery.');
    return null;
  }

  const isSecure = SMTP_SECURE === 'true' || SMTP_SECURE === '1';
  const port = Number(SMTP_PORT);

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    secure: isSecure,
    requireTLS: !isSecure && port === 587,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

const sanitizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
};

const buildNationalLeadSquaredPayload = (formData = {}) => {
  const {
    firstName = '',
    lastName = '',
    email = '',
    phone = '',
    message = '',
    source = '',
  } = formData;

  if (!firstName || !firstName.trim()) {
    const error = new Error('First name is required');
    error.status = 400;
    throw error;
  }

  const safePhone = sanitizePhone(phone);
  if (!safePhone) {
    const error = new Error('Phone is required');
    error.status = 400;
    throw error;
  }

  const leadSource = (source || 'landing Google Ads').trim();
  const fullName = `${firstName} ${lastName || ''}`.trim();

  const normalized = {
    firstName,
    lastName,
    email,
    phone: safePhone,
    message,
    source: leadSource,
  };

  const payload = [
    { Attribute: 'FirstName', Value: firstName },
    { Attribute: 'LastName', Value: lastName },
    { Attribute: 'EmailAddress', Value: email },
    { Attribute: 'Phone', Value: safePhone },
    { Attribute: 'Source', Value: leadSource },
    { Attribute: 'Notes', Value: message || 'Free Fertility Consultation Request' },
  ].filter((entry) => entry.Value !== undefined && entry.Value !== null && `${entry.Value}`.trim() !== '');

  return {
    leadSquaredPayload: payload,
    normalized,
  };
};

const resolveLeadSquaredUrl = () => {
  const trimmedBase = LEADSQUARED_BASE_URL.replace(/\/$/, '');

  if (LEADSQUARED_ENDPOINT) {
    return LEADSQUARED_ENDPOINT;
  }

  if (!trimmedBase) {
    const error = new Error('LeadSquared base URL is not configured');
    error.status = 500;
    throw error;
  }

  if (!LEADSQUARED_ACCESS_KEY || !LEADSQUARED_SECRET_KEY) {
    const error = new Error('LeadSquared keys are not configured');
    error.status = 500;
    throw error;
  }

  return `${trimmedBase}/v2/LeadManagement.svc/Lead.Create?accessKey=${encodeURIComponent(
    LEADSQUARED_ACCESS_KEY
  )}&secretKey=${encodeURIComponent(LEADSQUARED_SECRET_KEY)}`;
};

const postToLeadSquared = async (payload) => {
  const url = resolveLeadSquaredUrl();
  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  return response.data;
};

const sendNotificationEmail = async (formData, options = {}) => {
  const mailer = ensureTransporter();
  if (!mailer || !NOTIFICATION_EMAIL) return;
  const { leadSquaredStatus } = options;

  const normalizedData = { ...formData };
  if (leadSquaredStatus) {
    normalizedData.leadSquaredStatus = leadSquaredStatus;
  }

  const rows = Object.entries(normalizedData)
    .map(
      ([key, value]) =>
        `<tr>
          <td style="padding:6px 12px;text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1')}</td>
          <td style="padding:6px 12px;font-weight:600;">${value || 'NA'}</td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;">
      <h2 style="color:#c62828;margin-bottom:8px;">National Landing Page Lead</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  try {
    const subjectName = normalizedData.firstName || normalizedData.email || 'Lead';
    await mailer.sendMail({
      from: EMAIL_FROM,
      to: NOTIFICATION_EMAIL,
      subject: `New National Landing Page Lead - ${subjectName}`,
      html,
    });
    console.log('✅ Notification email sent successfully');
  } catch (err) {
    console.error('⚠️  Failed to send notification email (non-blocking):', err.code || err.responseCode || 'Unknown error');
    if (err.code === 'EAUTH') {
      console.error('   → SMTP Authentication failed. Please check SMTP_USER and SMTP_PASS in .env file');
    }
  }
};

const describeLeadSquaredError = (error) => {
  const statusPart = error.response?.status
    ? `HTTP ${error.response.status}${error.response.statusText ? ` ${error.response.statusText}` : ''}`
    : '';
  let messagePart = '';
  if (typeof error.response?.data === 'string') {
    messagePart = error.response.data;
  } else if (error.response?.data?.Message) {
    messagePart = error.response.data.Message;
  } else if (error.response?.data?.message) {
    messagePart = error.response.data.message;
  } else if (error.message) {
    messagePart = error.message;
  }

  return [statusPart, messagePart].filter(Boolean).join(' - ') || 'Unknown LeadSquared error';
};

const createNationalLandingPageLead = async (req, res) => {
  try {
    const submittedAt = new Date();

    const { leadSquaredPayload, normalized } = buildNationalLeadSquaredPayload(req.body || {});

    const emailPayload = {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      email: normalized.email,
      phone: normalized.phone,
      message: normalized.message,
      source: normalized.source,
    };

    let leadSquaredResponse;
    let leadSquaredError = null;
    try {
      leadSquaredResponse = await postToLeadSquared(leadSquaredPayload);
    } catch (err) {
      leadSquaredError = err;
      console.error('❌ LeadSquared submission failed (national landing page)');
      console.error('Status:', err.response?.status);
      console.error('Data:', JSON.stringify(err.response?.data, null, 2));
      console.error('Message:', err.message);
    }

    const leadSquaredStatusNote = leadSquaredError ? `FAILED – ${describeLeadSquaredError(leadSquaredError)}` : 'Success';

    await sendNotificationEmail(emailPayload, { leadSquaredStatus: leadSquaredStatusNote });

    if (leadSquaredError) {
      throw leadSquaredError;
    }

    const duplicate = Boolean(
      leadSquaredResponse?.duplicate ||
        leadSquaredResponse?.status === 'duplicate' ||
        leadSquaredResponse?.errorCode === 'DUPLICATE'
    );

    res.status(200).json({
      ok: true,
      duplicate,
      leadSquaredResponse,
      submittedAt: submittedAt.toISOString(),
    });
  } catch (error) {
    console.error('=== National landing page submission error ===');
    console.error('Error status:', error.status || error.response?.status);
    console.error('Error message:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('===============================================');

    const status = error.status || error.response?.status || 500;
    const message = error.response?.data || error.message || 'Unknown error';

    res.status(status).json({
      ok: false,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }
};

module.exports = {
  createNationalLandingPageLead,
};


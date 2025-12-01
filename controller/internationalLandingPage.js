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
    console.warn('Email credentials are not fully configured, skipping mail delivery.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || SMTP_SECURE === '1',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
};

const sanitizePhone = (phone) => {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
};

const buildInternationalLeadSquaredPayload = (formData = {}) => {
  const {
    husbandName = '',
    wifeName = '',
    email = '',
    phone = '',
    typeOfService = '',
    centerLocation = '',
  } = formData;

  if (!husbandName && !wifeName) {
    const error = new Error('At least one of husbandName or wifeName is required');
    error.status = 400;
    throw error;
  }

  if (!email) {
    const error = new Error('Email is required');
    error.status = 400;
    throw error;
  }

  const safePhone = sanitizePhone(phone);
  if (!safePhone) {
    const error = new Error('Phone is required');
    error.status = 400;
    throw error;
  }

  const fullName = [husbandName, wifeName].filter(Boolean).join(' & ');
  const leadSource = 'international';

  const notes = `Type of service: ${typeOfService || 'NA'}`;

  const normalized = {
    husbandName,
    wifeName,
    email,
    phone: safePhone,
    typeOfService,
    centerLocation,
    source: leadSource,
  };

  const payload = [
    { Attribute: 'FirstName', Value: fullName || husbandName || wifeName },
    { Attribute: 'EmailAddress', Value: email },
    { Attribute: 'Phone', Value: safePhone },
    { Attribute: 'mx_Center_Location', Value: centerLocation },
    { Attribute: 'Source', Value: leadSource },
    { Attribute: 'Notes', Value: notes },
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
      <h2 style="color:#c62828;margin-bottom:8px;">International Consultation Lead</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  try {
    const subjectName = normalizedData.husbandName || normalizedData.wifeName || normalizedData.email || 'Lead';
    await mailer.sendMail({
      from: EMAIL_FROM,
      to: NOTIFICATION_EMAIL,
      subject: `New International Consultation - ${subjectName}`,
      html,
    });
  } catch (err) {
    console.error('Failed to send notification email', err);
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

const createInternationalConsultation = async (req, res) => {
  try {
    const submittedAt = new Date();

    const { leadSquaredPayload, normalized } = buildInternationalLeadSquaredPayload(req.body || {});

    const emailPayload = {
      husbandName: normalized.husbandName,
      wifeName: normalized.wifeName,
      email: normalized.email,
      phone: normalized.phone,
      typeOfService: normalized.typeOfService,
      centerLocation: normalized.centerLocation,
      source: normalized.source,
    };

    let leadSquaredResponse;
    let leadSquaredError = null;
    try {
      leadSquaredResponse = await postToLeadSquared(leadSquaredPayload);
    } catch (err) {
      leadSquaredError = err;
      console.error('❌ LeadSquared submission failed (international)');
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
      success: true,
      message: duplicate
        ? 'We have already received your consultation request with these details.'
        : 'Your consultation request has been submitted successfully!',
      duplicate,
      leadSquaredResponse,
      submittedAt: submittedAt.toISOString(),
    });
  } catch (error) {
    console.error('=== International consultation submission error ===');
    console.error('Error status:', error.status || error.response?.status);
    console.error('Error message:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('===============================================');

    const status = error.status || error.response?.status || 500;
    const message = error.response?.data || error.message || 'Unknown error';

    res.status(status).json({
      success: false,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }
};

module.exports = {
  createInternationalConsultation,
};



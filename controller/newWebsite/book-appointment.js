const axios = require('axios');
const nodemailer = require('nodemailer');
const runtimeConfig = require('../../config/runtimeConfig');

const cleanEnvValue = (value) => (value || '').split('#')[0].trim();

const SMTP_HOST = cleanEnvValue(process.env.SMTP_HOST || runtimeConfig.SMTP_HOST);
const SMTP_PORT = cleanEnvValue(process.env.SMTP_PORT || runtimeConfig.SMTP_PORT);
const SMTP_USER = cleanEnvValue(process.env.SMTP_USER || runtimeConfig.SMTP_USER);
const SMTP_PASS = cleanEnvValue(process.env.SMTP_PASS || runtimeConfig.SMTP_PASS);
const SMTP_SECURE = cleanEnvValue(process.env.SMTP_SECURE || runtimeConfig.SMTP_SECURE);
const SMTP_FROM = cleanEnvValue(process.env.SMTP_FROM || runtimeConfig.SMTP_FROM);

const LEADSQUARED_BASE_URL = cleanEnvValue(
  process.env.LSQ_BASE_URL || process.env.LEADSQUARED_BASE_URL || process.env.LEADSQUARED_DOMAIN || ''
    || runtimeConfig.LSQ_BASE_URL
);
const LEADSQUARED_ENDPOINT = cleanEnvValue(
  process.env.LSQ_ENDPOINT || process.env.LEADSQUARED_ENDPOINT || process.env.LEADSQUARED_URL || ''
);
const LEADSQUARED_ACCESS_KEY = cleanEnvValue(
  process.env.LSQ_ACCESS_KEY || process.env.LEADSQUARED_ACCESS_KEY || runtimeConfig.LSQ_ACCESS_KEY
);
const LEADSQUARED_SECRET_KEY = cleanEnvValue(
  process.env.LSQ_SECRET_KEY || process.env.LEADSQUARED_SECRET_KEY || runtimeConfig.LSQ_SECRET_KEY
);
const NOTIFICATION_EMAIL = cleanEnvValue(
  process.env.RECEIVER_EMAIL || process.env.NOTIFICATION_EMAIL || runtimeConfig.RECEIVER_EMAIL
);
const EMAIL_FROM =
  cleanEnvValue(process.env.EMAIL_FROM || runtimeConfig.EMAIL_FROM || SMTP_FROM) ||
  `"SOI Website" <${SMTP_USER || 'no-reply@example.com'}>`;
const DUPLICATE_MESSAGE = 'Already filled your application';

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

const validateIndianPhone = (phone) => {
  if (!/^[6-9]\d{9}$/.test(phone)) {
    const error = new Error('Invalid number');
    error.status = 400;
    throw error;
  }
};

const splitName = (fullName) => {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
};

const normalizeCenterName = (center) => {
  const rawCenter = String(center || '').trim().replace(/^\*+\s*/, '');
  if (!rawCenter) return '';

  // Display names are stored as "City, State". LSQ only needs the city.
  if (rawCenter.includes(',')) return rawCenter.split(',')[0].trim();

  // Backward compatibility for clients that still submit centre slugs.
  const stateSuffixes = [
    'andaman-and-nicobar-islands', 'andhra-pradesh', 'arunachal-pradesh',
    'dadra-and-nagar-haveli-and-daman-and-diu', 'himachal-pradesh',
    'jammu-and-kashmir', 'madhya-pradesh', 'tamil-nadu', 'uttar-pradesh',
    'uttarakhand', 'west-bengal', 'chhattisgarh', 'maharashtra', 'meghalaya',
    'telangana', 'karnataka', 'jharkhand', 'haryana', 'gujarat', 'rajasthan',
    'punjab', 'odisha', 'assam', 'bihar', 'goa', 'kerala', 'manipur',
    'mizoram', 'nagaland', 'sikkim', 'tripura', 'delhi', 'chandigarh',
    'ladakh', 'puducherry',
  ];
  const slug = rawCenter.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stateSuffix = stateSuffixes.find((state) => slug.endsWith(`-${state}`));
  const citySlug = stateSuffix ? slug.slice(0, -(stateSuffix.length + 1)) : slug;

  return citySlug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const validateCaptcha = ({ captchaAccepted }) => {
  if (captchaAccepted === undefined) return;

  const isAccepted = captchaAccepted === true || String(captchaAccepted).toLowerCase() === 'true';

  if (!isAccepted) {
    const error = new Error('Please confirm that you are not a robot.');
    error.status = 400;
    throw error;
  }
};

const buildLeadSquaredPayload = (formData) => {
  const {
    name = '',
    phone,
    email = '',
    center = '',
    message = '',
    utm_source = '',
    utm_medium = '',
    utm_campaign = '',
  } = formData;

  const leadSource = 'New Website Form';

  validateCaptcha(formData);

  const safePhone = sanitizePhone(phone);
  const selectedCenter = normalizeCenterName(center);
  if (!name || !safePhone || !selectedCenter) {
    const error = new Error('Missing required fields: name, phone and center');
    error.status = 400;
    throw error;
  }
  validateIndianPhone(safePhone);

  const { firstName, lastName } = splitName(name);
  const safeUtmSource = String(utm_source || '').trim();
  const safeUtmMedium = String(utm_medium || '').trim();
  const safeUtmCampaign = String(utm_campaign || '').trim();

  // Build appointment details for notes
  const appointmentDetails = [
    `Center: ${selectedCenter || 'NA'}`,
  ].filter(item => !item.includes('NA')).join(' | ');

  const notesMessage = message 
    ? `${appointmentDetails}${appointmentDetails ? ' | ' : ''}Message: ${message}`
    : appointmentDetails || 'Appointment booking request';

  // Full message for email (includes all details)
  const fullMessage = [
    `Center: ${selectedCenter || 'NA'}`,
    message ? `Message: ${message}` : '',
  ].filter(Boolean).join(' | ');

  const normalized = {
    firstName,
    lastName,
    phone: safePhone,
    email,
    center: selectedCenter,
    message: fullMessage,
    source: leadSource,
    utm_source: safeUtmSource,
    utm_medium: safeUtmMedium,
    utm_campaign: safeUtmCampaign,
  };

  const payload = [
    { Attribute: 'FirstName', Value: firstName },
    { Attribute: 'LastName', Value: lastName },
    { Attribute: 'Phone', Value: safePhone },
    { Attribute: 'EmailAddress', Value: email },
    { Attribute: 'mx_Centerr_Location', Value: selectedCenter },
    { Attribute: 'Source', Value: leadSource },
    { Attribute: 'Notes', Value: notesMessage },
    { Attribute: 'mx_utm_source', Value: safeUtmSource },
    { Attribute: 'mx_utm_medium', Value: safeUtmMedium },
    { Attribute: 'mx_utm_campaign', Value: safeUtmCampaign },
  ].filter(entry => entry.Value !== undefined && entry.Value !== null && `${entry.Value}`.trim() !== '');

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
  if (!mailer) {
    const error = new Error('SMTP is not configured. Notification email cannot be sent.');
    error.status = 500;
    throw error;
  }
  if (!NOTIFICATION_EMAIL) {
    const error = new Error('Notification email recipient is not configured.');
    error.status = 500;
    throw error;
  }
  const { leadSquaredStatus } = options;

  const emailData = {
    name: formData.name || `${formData.firstName} ${formData.lastName || ''}`.trim(),
    phone: formData.phone,
    email: formData.email,
    center: formData.center,
    message: formData.message,
    utm_source: formData.utm_source,
    utm_medium: formData.utm_medium,
    utm_campaign: formData.utm_campaign,
  };

  if (leadSquaredStatus) {
    emailData.leadSquaredStatus = leadSquaredStatus;
  }

  const rows = Object.entries(emailData)
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
      <h2 style="color:#c62828;margin-bottom:8px;">New Appointment Booking Request</h2>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const subjectName = emailData.name || 'Lead';
  await mailer.sendMail({
    from: EMAIL_FROM,
    to: NOTIFICATION_EMAIL,
    subject: `New Appointment Booking - ${subjectName}`,
    html,
  });
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

const isDuplicateLeadSquaredResponse = (response) => {
  if (!response) return false;
  const errorCode = `${response.errorCode || response.ErrorCode || ''}`.toUpperCase();
  const status = `${response.status || response.Status || ''}`.toLowerCase();
  const message = `${response.message || response.Message || ''}`.toLowerCase();
  const duplicateFlag = response.duplicate === true;
  return duplicateFlag || errorCode.includes('DUPLICATE') || status.includes('duplicate') || message.includes('duplicate');
};

const isDuplicateLeadSquaredError = (error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const stringified = typeof data === 'string' ? data : JSON.stringify(data || {});
  const message = `${error?.message || ''} ${stringified}`.toLowerCase();
  return status === 409 || message.includes('duplicate');
};
console.log("RAW ACCESS KEY:", JSON.stringify(process.env.LSQ_ACCESS_KEY));
console.log("RAW SECRET KEY:", JSON.stringify(process.env.LSQ_SECRET_KEY));
console.log("ACCESS KEY LENGTH:", process.env.LSQ_ACCESS_KEY?.length);
console.log("SECRET KEY LENGTH:", process.env.LSQ_SECRET_KEY?.length);
const createBookAppointment = async (req, res) => {
  try {
    const submittedAt = new Date();

    const { leadSquaredPayload, normalized } = buildLeadSquaredPayload({
      ...req.body,
      source: 'Website Form',
    });

    const emailPayload = {
      name: `${normalized.firstName} ${normalized.lastName || ''}`.trim(),
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      phone: normalized.phone,
      email: normalized.email,
      center: normalized.center,
      message: normalized.message,
      source: normalized.source,
      ...(normalized.utm_source && { utm_source: normalized.utm_source }),
      ...(normalized.utm_medium && { utm_medium: normalized.utm_medium }),
      ...(normalized.utm_campaign && { utm_campaign: normalized.utm_campaign }),
    };

    let leadSquaredResponse;
    let leadSquaredError = null;
    try {
      leadSquaredResponse = await postToLeadSquared(leadSquaredPayload);
    } catch (err) {
      leadSquaredError = err;
      console.error('❌ LeadSquared submission failed');
      console.error('Status:', err.response?.status);
      console.error('Data:', JSON.stringify(err.response?.data, null, 2));
      console.error('Message:', err.message);
    }

    if (leadSquaredError && isDuplicateLeadSquaredError(leadSquaredError)) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        error: DUPLICATE_MESSAGE,
      });
    }

    if (!leadSquaredError && isDuplicateLeadSquaredResponse(leadSquaredResponse)) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        error: DUPLICATE_MESSAGE,
      });
    }

    const leadSquaredStatusNote = leadSquaredError ? `FAILED – ${describeLeadSquaredError(leadSquaredError)}` : 'Success';
    let emailError = null;
    try {
      await sendNotificationEmail(emailPayload, { leadSquaredStatus: leadSquaredStatusNote });
    } catch (err) {
      emailError = err;
      console.error('❌ Notification email sending failed');
      console.error('Message:', err.message);
    }

    if (leadSquaredError) {
      const combinedError = new Error(`LeadSquared: ${describeLeadSquaredError(leadSquaredError)}`);
      combinedError.status = leadSquaredError?.response?.status || 500;
      throw combinedError;
    }

    const duplicate = Boolean(
      leadSquaredResponse?.duplicate ||
        leadSquaredResponse?.status === 'duplicate' ||
        leadSquaredResponse?.errorCode === 'DUPLICATE'
    );

    res.status(201).json({
      ok: true,
      duplicate,
      leadSquaredResponse,
      emailSent: !emailError,
      ...(emailError ? { warning: `Email notification failed: ${emailError.message}` } : {}),
      submittedAt: submittedAt.toISOString(),
    });
  } catch (error) {
    console.error('=== Appointment booking submission error details ===');
    console.error('Error status:', error.status || error.response?.status);
    console.error('Error message:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status === 412) {
      console.error('⚠️ LeadSquared returned 412 Precondition Failed - this usually means invalid field names or format');
    }
    console.error('========================================');

    const status = error.status || error.response?.status || 500;
    const message = error.response?.data || error.message || 'Unknown error';

    res.status(status).json({
      ok: false,
      error: typeof message === 'string' ? message : JSON.stringify(message),
    });
  }
};

module.exports = {
  createBookAppointment,
};

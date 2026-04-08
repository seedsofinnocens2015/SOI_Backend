const nodemailer = require('nodemailer');

const cleanEnvValue = (value) => (value || '').split('#')[0].trim();

const SMTP_HOST = cleanEnvValue(process.env.SMTP_HOST);
const SMTP_PORT = cleanEnvValue(process.env.SMTP_PORT);
const SMTP_USER = cleanEnvValue(process.env.SMTP_USER);
const SMTP_PASS = cleanEnvValue(process.env.SMTP_PASS);
const SMTP_SECURE = cleanEnvValue(process.env.SMTP_SECURE);
const SMTP_FROM = cleanEnvValue(process.env.SMTP_FROM);
const EMAIL_FROM =
  cleanEnvValue(process.env.EMAIL_FROM || SMTP_FROM) || `"SOI Website" <${SMTP_USER || 'no-reply@example.com'}>`;
const FEEDBACK_NOTIFICATION_EMAIL = cleanEnvValue(
  process.env.FEEDBACK_RECEIVER_EMAIL || 'feedback@seedsofinnocence.com'
);

let transporter;

const ensureTransporter = () => {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const error = new Error('Email credentials are not fully configured.');
    error.status = 500;
    throw error;
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

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getFormValue = (body, key) => {
  const value = body?.[key];
  return typeof value === 'string' ? value.trim() : value;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sendFeedbackNotificationEmail = async (payload) => {
  const mailer = ensureTransporter();

  const rows = Object.entries(payload)
    .map(
      ([key, value]) =>
        `<tr>
          <td style="padding:8px 12px;text-transform:capitalize;border:1px solid #eee;">${escapeHtml(
            key.replace(/([A-Z])/g, ' $1')
          )}</td>
          <td style="padding:8px 12px;font-weight:600;border:1px solid #eee;">${escapeHtml(value || 'NA')}</td>
        </tr>`
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;">
      <h2 style="color:#c62828;margin-bottom:12px;">New Website Feedback Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px;">
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  const subjectName = payload.name || 'Anonymous User';
  await mailer.sendMail({
    from: EMAIL_FROM,
    to: FEEDBACK_NOTIFICATION_EMAIL,
    subject: `New Feedback Submission - ${subjectName}`,
    html,
  });
};

const createUnifiedFormSubmission = async (req, res) => {
  try {
    const formType = getFormValue(req.body, 'formType');
    if (formType !== 'feedback') {
      return res.status(400).json({
        ok: false,
        error: `Unsupported form type: ${formType || 'unknown'}`,
      });
    }

    const payload = {
      formType: 'feedback',
      name: getFormValue(req.body, 'name'),
      email: getFormValue(req.body, 'email'),
      phone: getFormValue(req.body, 'phone'),
      center: getFormValue(req.body, 'center'),
      feedbackType: getFormValue(req.body, 'feedbackType'),
      rating: getFormValue(req.body, 'rating'),
      feedback: getFormValue(req.body, 'feedback'),
      submittedAt: new Date().toISOString(),
    };

    if (!payload.name || !payload.feedbackType || !payload.rating || !payload.feedback) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required feedback fields.',
      });
    }
    if (payload.email && !isValidEmail(payload.email)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid email address.',
      });
    }

    await sendFeedbackNotificationEmail(payload);

    return res.status(201).json({
      ok: true,
      message: 'Feedback submitted successfully.',
    });
  } catch (error) {
    console.error('Feedback form submission error:', error.message);
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Unable to process feedback submission.',
    });
  }
};

module.exports = {
  createUnifiedFormSubmission,
};

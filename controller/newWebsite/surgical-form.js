const nodemailer = require('nodemailer');
const runtimeConfig = require('../../config/runtimeConfig');

const cleanEnvValue = (value) => (value || '').split('#')[0].trim();

const SMTP_HOST = cleanEnvValue(process.env.SMTP_HOST || runtimeConfig.SMTP_HOST);
const SMTP_CONNECT_HOST = cleanEnvValue(
  process.env.SURGICAL_SMTP_IP || runtimeConfig.SURGICAL_SMTP_IP || '68.178.145.239'
);
const SMTP_PORT = cleanEnvValue(process.env.SMTP_PORT || runtimeConfig.SMTP_PORT);
const SMTP_USER = cleanEnvValue(process.env.SMTP_USER || runtimeConfig.SMTP_USER);
const SMTP_PASS = cleanEnvValue(process.env.SMTP_PASS || runtimeConfig.SMTP_PASS);
const SMTP_SECURE = cleanEnvValue(process.env.SMTP_SECURE || runtimeConfig.SMTP_SECURE);
const SMTP_FROM = cleanEnvValue(process.env.SMTP_FROM || runtimeConfig.SMTP_FROM);
const SURGICAL_NOTIFICATION_EMAIL = cleanEnvValue(
  process.env.SURGICAL_RECEIVER_EMAIL || runtimeConfig.SURGICAL_RECEIVER_EMAIL || 'soisurgicalcentre@gmail.com'
);
const EMAIL_FROM =
  cleanEnvValue(process.env.EMAIL_FROM || runtimeConfig.EMAIL_FROM || SMTP_FROM) ||
  `"SOI Surgical Center" <${SMTP_USER || 'no-reply@example.com'}>`;
const SURGICAL_FROM = `"SOI Surgical Center" <${SMTP_USER}>`;

let transporter;

const ensureTransporter = () => {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    const error = new Error('SMTP is not configured.');
    error.status = 500;
    throw error;
  }

  transporter = nodemailer.createTransport({
    // The production resolver intermittently times out while resolving
    // mail.seedsofinnocence.com. Connect to its A record directly while
    // retaining the hostname for STARTTLS certificate verification.
    host: SMTP_CONNECT_HOST || SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true' || SMTP_SECURE === '1',
    requireTLS: Number(SMTP_PORT) === 587,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    tls: {
      servername: SMTP_HOST,
    },
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
};

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const sanitizePhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

const createSurgicalFormSubmission = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const phone = sanitizePhone(req.body?.phone);
    const center = String(req.body?.center || '').trim();
    const message = String(req.body?.message || '').trim();
    const source = String(req.body?.source || 'Surgical Center Page').trim();
    const captchaAccepted =
      req.body?.captchaAccepted === true ||
      String(req.body?.captchaAccepted || '').toLowerCase() === 'true';

    if (!name || !phone || !center) {
      return res.status(400).json({
        ok: false,
        error: 'Name, phone number and center are required.',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid number',
      });
    }

    if (!captchaAccepted) {
      return res.status(400).json({
        ok: false,
        error: 'Please accept the Privacy Policy and T&C.',
      });
    }

    const rows = [
      ['Name', name],
      ['Phone', phone],
      ['Center', center],
      ['Message', message || 'Not provided'],
      ['Consent Accepted', 'Yes'],
      ['Source', source],
      ['Submitted At', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
    ]
      .map(
        ([label, value]) => `
          <tr>
            <td style="padding:10px 12px;border:1px solid #e5e5e5;color:#555;">${escapeHtml(label)}</td>
            <td style="padding:10px 12px;border:1px solid #e5e5e5;font-weight:600;">${escapeHtml(value)}</td>
          </tr>`
      )
      .join('');

    const submittedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const text = [
      'New Surgical Consultation Request',
      '',
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Center: ${center}`,
      `Message: ${message || 'Not provided'}`,
      'Consent Accepted: Yes',
      `Source: ${source}`,
      `Submitted At: ${submittedAt}`,
    ].join('\n');

    const mailInfo = await ensureTransporter().sendMail({
      // Keep the visible sender and SMTP envelope aligned with the authenticated
      // mailbox. This improves SPF/DMARC alignment and Gmail delivery.
      from: SURGICAL_FROM || EMAIL_FROM,
      to: SURGICAL_NOTIFICATION_EMAIL,
      envelope: {
        from: SMTP_USER,
        to: SURGICAL_NOTIFICATION_EMAIL,
      },
      replyTo: SMTP_USER,
      subject: `New Surgical Consultation Request - ${name}`,
      text,
      html: `
        <div style="font-family:Arial,sans-serif;color:#222;">
          <h2 style="color:#df3655;">New Surgical Consultation Request</h2>
          <table style="width:100%;max-width:640px;border-collapse:collapse;">
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:18px;color:#777;font-size:12px;">
            This notification was sent by the Seeds of Innocens Surgical Center website form.
          </p>
        </div>
      `,
    });

    const acceptedRecipients = (mailInfo.accepted || []).map((email) => String(email).toLowerCase());
    if (!acceptedRecipients.includes(SURGICAL_NOTIFICATION_EMAIL.toLowerCase())) {
      const error = new Error(`SMTP did not accept recipient: ${SURGICAL_NOTIFICATION_EMAIL}`);
      error.status = 502;
      throw error;
    }

    console.log('Surgical form email accepted by SMTP:', {
      recipient: SURGICAL_NOTIFICATION_EMAIL,
      messageId: mailInfo.messageId,
      response: mailInfo.response,
      envelope: mailInfo.envelope,
    });

    return res.status(201).json({
      ok: true,
      message: 'Consultation request submitted successfully.',
      delivery: {
        recipient: SURGICAL_NOTIFICATION_EMAIL,
        messageId: mailInfo.messageId,
        accepted: acceptedRecipients,
        smtpResponse: mailInfo.response,
      },
    });
  } catch (error) {
    console.error('Surgical form submission failed:', error.message);
    return res.status(error.status || 500).json({
      ok: false,
      error: 'Unable to submit your request right now. Please try again.',
    });
  }
};

module.exports = {
  createSurgicalFormSubmission,
};

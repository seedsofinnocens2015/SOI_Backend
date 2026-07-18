const nodemailer = require('nodemailer');
const runtimeConfig = require('../../config/runtimeConfig');

const CAREERS_RECEIVER_EMAIL =
  process.env.CAREERS_RECEIVER_EMAIL ||
  runtimeConfig.CAREERS_RECEIVER_EMAIL ||
  'career@seedsofinnocence.com';

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || runtimeConfig.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || runtimeConfig.SMTP_PORT);
  const user = process.env.SMTP_USER || runtimeConfig.SMTP_USER;
  const pass = process.env.SMTP_PASS || runtimeConfig.SMTP_PASS;
  const secureValue = process.env.SMTP_SECURE ?? runtimeConfig.SMTP_SECURE;

  if (!host || !port || !user || !pass) {
    throw new Error('Application email SMTP configuration is incomplete.');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: secureValue === true || secureValue === 'true' || secureValue === '1',
    auth: { user, pass },
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n/g, '<br>');
}

function displayValue(value) {
  if (value === undefined || value === null || String(value).trim() === '') return 'Not provided';
  return escapeHtml(value);
}

function buildRows(application) {
  const isGeneral = application.applicationType === 'general';
  const commonRows = [
    ['Application Type', isGeneral ? 'General Application' : 'Current Opening'],
    ['Candidate Name', application.fullName],
    ['Email', application.email],
    ['Phone', application.phone],
    ['Experience', application.applicantExperience],
    ['Current Location', application.currentLocation],
    ['Qualification', application.qualification],
    ['Hiring Status', application.status],
    ['Submitted At', application.createdAt ? new Date(application.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''],
    ['Application ID', application._id],
  ];

  const applicationRows = isGeneral
    ? [
        ['Preferred Position / Role', application.preferredPosition || application.positionTitle],
        ['Area of Interest / Department', application.jobField || application.department],
        ['Requirements & Expectations', application.requirements],
        ['Skills & Specializations', application.skills],
        ['Additional Information / Cover Letter', application.additionalInfo || application.coverLetter],
      ]
    : [
        ['Position Applied For', application.positionTitle],
        ['Position Location', application.positionLocation],
        ['Job Field', application.jobField],
        ['Work Type', application.employmentType],
        ['Notice Period', application.noticePeriod],
        ['Current Organization', application.currentOrganization],
        ['Current CTC', application.currentCtc],
        ['Expected CTC', application.expectedCtc],
        ['Cover Letter / Additional Information', application.coverLetter],
      ];

  return [...commonRows.slice(0, 1), ...applicationRows, ...commonRows.slice(1)];
}

function buildEmailHtml(application, resumeFile) {
  const rows = buildRows(application)
    .map(([label, value]) => `
      <tr>
        <td style="width:34%;padding:10px 12px;border:1px solid #e5e7eb;background:#f8fafc;color:#475569;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;color:#18181b;vertical-align:top;">${displayValue(value)}</td>
      </tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;color:#18181b;">
      <div style="padding:22px 24px;background:#df3655;color:#fff;border-radius:14px 14px 0 0;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;opacity:.9;">Seeds of Innocence Careers</div>
        <h2 style="margin:8px 0 0;font-size:23px;">New ${application.applicationType === 'general' ? 'General' : 'Job'} Application</h2>
      </div>
      <div style="padding:22px 24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 14px 14px;">
        <p style="margin:0 0 18px;line-height:1.6;color:#52525b;">A new careers application has been submitted. Complete details are below.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;"><tbody>${rows}</tbody></table>
        <div style="margin-top:18px;padding:14px 16px;background:#eff6ff;border-radius:10px;color:#1e40af;font-size:13px;font-weight:700;">
          Resume/CV attached: ${escapeHtml(resumeFile.originalname)} (${Math.max(1, Math.round(resumeFile.size / 1024))} KB). Open or download it directly from this email.
        </div>
      </div>
    </div>`;
}

async function sendApplicationNotificationEmail(applicationDocument, resumeFile) {
  const application = typeof applicationDocument.toObject === 'function'
    ? applicationDocument.toObject()
    : applicationDocument;
  const from = process.env.EMAIL_FROM || runtimeConfig.EMAIL_FROM || process.env.SMTP_FROM || runtimeConfig.SMTP_FROM || process.env.SMTP_USER || runtimeConfig.SMTP_USER;
  const applicationLabel = application.applicationType === 'general' ? 'General Application' : 'Job Application';
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email || '')
    ? application.email
    : undefined;
  const safeFileName = String(resumeFile.originalname || 'resume')
    .replace(/[\r\n"\\/]/g, '_');

  await getTransporter().sendMail({
    from,
    to: CAREERS_RECEIVER_EMAIL,
    replyTo,
    subject: `${applicationLabel}: ${application.fullName} - ${application.positionTitle}`,
    html: buildEmailHtml(application, resumeFile),
    attachments: [
      {
        filename: safeFileName,
        content: resumeFile.buffer,
        contentType: resumeFile.mimetype || 'application/octet-stream',
      },
    ],
  });
}

module.exports = { sendApplicationNotificationEmail };

const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const runtimeConfig = require('../../config/runtimeConfig');

const SeoUser = require('../model/SeoUser');
const SeoAuthOtp = require('../model/SeoAuthOtp');

const JWT_EXPIRY = '7d';
const ALLOWED_EMAIL_DOMAINS = ['@seedsofinnocence.com', '@seedsofinnocens.com'];
const ADMIN_EMAILS = new Set(['amitkumaryadav8314@gmail.com']);
const OTP_TTL_SECONDS = 60;
const OTP_ATTEMPTS = 5;

const cleanEnvValue = (value) => (value || '').split('#')[0].trim();
const SMTP_HOST = cleanEnvValue(process.env.SMTP_HOST || runtimeConfig.SMTP_HOST);
const SMTP_PORT = cleanEnvValue(process.env.SMTP_PORT || runtimeConfig.SMTP_PORT);
const SMTP_USER = cleanEnvValue(process.env.SMTP_USER || runtimeConfig.SMTP_USER);
const SMTP_PASS = cleanEnvValue(process.env.SMTP_PASS || runtimeConfig.SMTP_PASS);
const SMTP_SECURE = cleanEnvValue(process.env.SMTP_SECURE || runtimeConfig.SMTP_SECURE);
const SMTP_FROM = cleanEnvValue(process.env.SMTP_FROM || runtimeConfig.SMTP_FROM);
const EMAIL_FROM =
  cleanEnvValue(process.env.EMAIL_FROM || runtimeConfig.EMAIL_FROM || SMTP_FROM) ||
  `"SOI Website" <${SMTP_USER || 'no-reply@example.com'}>`;

let transporter;

function getJwtSecret() {
  return process.env.SEO_AUTH_JWT_SECRET || process.env.JWT_SECRET || runtimeConfig.SEO_AUTH_JWT_SECRET;
}

function normalizeEmail(email = '') {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role = '') {
  const normalizedRole = String(role || '').trim().toLowerCase();
  return ['seo', 'hr'].includes(normalizedRole) ? normalizedRole : '';
}

function isAdminEmail(email = '') {
  return ADMIN_EMAILS.has(normalizeEmail(email));
}

function getEffectiveRole(user) {
  if (isAdminEmail(user?.email)) return 'admin';
  return ['seo', 'hr', 'admin'].includes(user?.role) ? user.role : 'seo';
}

function isAllowedEmailDomain(email = '') {
  return isAdminEmail(email) || ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(domain));
}

function createAuthResponse(user, requestedRole = 'seo') {
  // Users created before role support are SEO users by default. This fallback
  // keeps every existing account working without a database migration.
  const role = getEffectiveRole(user);
  const activeRole = role === 'admin' ? normalizeRole(requestedRole) || 'seo' : role;
  const payload = { userId: user._id, email: user.email, role, activeRole };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRY });
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role,
      activeRole,
    },
  };
}

function ensureTransporter() {
  if (transporter) return transporter;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
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
}

function generateOtpCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtpEmail({ email, otpCode, purpose }) {
  const mailer = ensureTransporter();
  if (!mailer) {
    const error = new Error('SMTP is not configured. OTP email cannot be sent.');
    error.status = 500;
    throw error;
  }

  const actionLabel = purpose === 'signup' ? 'signup' : 'login';
  const html = `
    <div style="font-family:Arial,sans-serif;">
      <h2 style="margin:0 0 12px;color:#c62828;">SOI Panel OTP Verification</h2>
      <p style="margin:0 0 8px;">Use the OTP below to complete your ${actionLabel}.</p>
      <p style="font-size:28px;letter-spacing:4px;font-weight:700;margin:12px 0;color:#111827;">${otpCode}</p>
      <p style="margin:0;color:#4b5563;">This OTP is valid for 1 minute.</p>
    </div>
  `;

  await mailer.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: `SOI Panel OTP for ${actionLabel}`,
    html,
  });
}

async function requestSignupOtp(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = normalizeRole(req.body?.role);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ ok: false, error: 'Name, email, password and role are required' });
    }

    if (!isAllowedEmailDomain(email)) {
      return res.status(400).json({
        ok: false,
        error:
          'Only company emails are allowed. Use @seedsofinnocence.com or @seedsofinnocens.com',
      });
    }

    if (password.length < 10) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 10 characters' });
    }

    const existingUser = await SeoUser.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({ ok: false, error: 'User already exists with this email' });
    }

    // This single owner account is intentionally password-only. The exception
    // is enforced on the server so no other email can bypass OTP from the UI.
    if (isAdminEmail(email)) {
      const user = await SeoUser.create({ name, email, password, role: 'admin' });
      return res.status(201).json({ ok: true, data: createAuthResponse(user, role) });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await SeoAuthOtp.findOneAndUpdate(
      { email, purpose: 'signup' },
      {
        email,
        purpose: 'signup',
        otpCode,
        expiresAt,
        attemptsLeft: OTP_ATTEMPTS,
        pendingSignupName: name,
        pendingSignupPassword: password,
        pendingRole: role,
        pendingLoginUserId: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail({ email, otpCode, purpose: 'signup' });
    return res.status(200).json({ ok: true, data: { message: 'OTP sent to your email', expiresInSeconds: OTP_TTL_SECONDS } });
  } catch (error) {
    console.error('[SEO][auth][requestSignupOtp] Error', error);
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Failed to send OTP' });
  }
}

async function verifySignupOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otpCode = String(req.body?.otp || '').trim();

    if (!email || !otpCode) {
      return res.status(400).json({ ok: false, error: 'Email and OTP are required' });
    }

    const pendingOtp = await SeoAuthOtp.findOne({ email, purpose: 'signup' });
    if (!pendingOtp || pendingOtp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: 'OTP expired or not found. Please request a new OTP.' });
    }

    if (pendingOtp.otpCode !== otpCode) {
      pendingOtp.attemptsLeft = Math.max(0, (pendingOtp.attemptsLeft || 0) - 1);
      if (pendingOtp.attemptsLeft <= 0) {
        await pendingOtp.deleteOne();
        return res.status(400).json({ ok: false, error: 'Too many invalid attempts. Request OTP again.' });
      }
      await pendingOtp.save();
      return res.status(400).json({ ok: false, error: `Invalid OTP. Attempts left: ${pendingOtp.attemptsLeft}` });
    }

    const existingUser = await SeoUser.findOne({ email });
    if (existingUser) {
      await pendingOtp.deleteOne();
      return res.status(409).json({ ok: false, error: 'User already exists with this email' });
    }

    const user = await SeoUser.create({
      name: pendingOtp.pendingSignupName,
      email,
      password: pendingOtp.pendingSignupPassword,
      role: isAdminEmail(email) ? 'admin' : normalizeRole(pendingOtp.pendingRole) || 'seo',
    });
    await pendingOtp.deleteOne();

    return res.status(201).json({ ok: true, data: createAuthResponse(user, pendingOtp.pendingRole) });
  } catch (error) {
    console.error('[SEO][auth][verifySignupOtp] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to verify OTP' });
  }
}

async function requestLoginOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const role = normalizeRole(req.body?.role);

    if (!email || !password || !role) {
      return res.status(400).json({ ok: false, error: 'Email, password and role are required' });
    }

    if (password.length < 10) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 10 characters' });
    }

    const user = await SeoUser.findOne({ email });
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const isPasswordValid = password === String(user.password || '');
    if (!isPasswordValid) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const userRole = getEffectiveRole(user);
    if (userRole !== 'admin' && userRole !== role) {
      return res.status(403).json({
        ok: false,
        error: `This account is registered for the ${userRole.toUpperCase()} panel`,
      });
    }

    if (isAdminEmail(email)) {
      return res.status(200).json({ ok: true, data: createAuthResponse(user, role) });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    await SeoAuthOtp.findOneAndUpdate(
      { email, purpose: 'login' },
      {
        email,
        purpose: 'login',
        otpCode,
        expiresAt,
        attemptsLeft: OTP_ATTEMPTS,
        pendingSignupName: '',
        pendingSignupPassword: '',
        pendingRole: role,
        pendingLoginUserId: user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendOtpEmail({ email, otpCode, purpose: 'login' });
    return res.status(200).json({ ok: true, data: { message: 'OTP sent to your email', expiresInSeconds: OTP_TTL_SECONDS } });
  } catch (error) {
    console.error('[SEO][auth][requestLoginOtp] Error', error);
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Failed to send OTP' });
  }
}

async function verifyLoginOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otpCode = String(req.body?.otp || '').trim();

    if (!email || !otpCode) {
      return res.status(400).json({ ok: false, error: 'Email and OTP are required' });
    }

    const pendingOtp = await SeoAuthOtp.findOne({ email, purpose: 'login' });
    if (!pendingOtp || pendingOtp.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, error: 'OTP expired or not found. Please request a new OTP.' });
    }

    if (pendingOtp.otpCode !== otpCode) {
      pendingOtp.attemptsLeft = Math.max(0, (pendingOtp.attemptsLeft || 0) - 1);
      if (pendingOtp.attemptsLeft <= 0) {
        await pendingOtp.deleteOne();
        return res.status(400).json({ ok: false, error: 'Too many invalid attempts. Request OTP again.' });
      }
      await pendingOtp.save();
      return res.status(400).json({ ok: false, error: `Invalid OTP. Attempts left: ${pendingOtp.attemptsLeft}` });
    }

    const user = await SeoUser.findById(pendingOtp.pendingLoginUserId);
    if (!user) {
      await pendingOtp.deleteOne();
      return res.status(404).json({ ok: false, error: 'User not found. Please login again.' });
    }

    await pendingOtp.deleteOne();
    return res.status(200).json({ ok: true, data: createAuthResponse(user, pendingOtp.pendingRole) });
  } catch (error) {
    console.error('[SEO][auth][verifyLoginOtp] Error', error);
    return res.status(500).json({ ok: false, error: 'Failed to verify OTP' });
  }
}

module.exports = {
  requestSignupOtp,
  verifySignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
};

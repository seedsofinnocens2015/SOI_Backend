const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const runtimeConfig = require('../../config/runtimeConfig');

const SeoUser = require('../model/SeoUser');
const SeoAuthOtp = require('../model/SeoAuthOtp');

const JWT_EXPIRY = '7d';
const ALLOWED_EMAIL_DOMAINS = ['@seedsofinnocence.com', '@seedsofinnocens.com'];
const ADMIN_EMAILS = new Set(['amitkumaryadav8314@gmail.com']);
const OTP_TTL_SECONDS = 60;
const OTP_ATTEMPTS = 5;
const PASSWORD_SALT_ROUNDS = 12;

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

function isPasswordHash(password = '') {
  return /^\$2[aby]\$/.test(String(password || ''));
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), PASSWORD_SALT_ROUNDS);
}

async function passwordMatches(password, storedPassword) {
  if (isPasswordHash(storedPassword)) {
    return bcrypt.compare(String(password), String(storedPassword));
  }
  // Backward compatibility for accounts created before password hashing was added.
  return String(password) === String(storedPassword || '');
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
      loginId: user.loginId || (user.email ? user.email.split('@')[0] : 'user'),
      name: user.name,
      email: user.email,
      role,
      activeRole,
      userType: user.userType || (role === 'admin' ? 'Administrator' : 'Team Member'),
      status: user.status || 'Active',
      canManageTeam: Boolean(user.canManageTeam),
      isAdministrator: Boolean(user.isAdministrator || role === 'admin'),
      recruiter: user.recruiter || '',
      workVisibility: Boolean(user.workVisibility),
      permissions: user.permissions || {},
      addedBy: user.addedBy || 'System',
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

  const actionLabel = purpose === 'signup' ? 'signup' : purpose === 'reset' ? 'password reset' : 'login';
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
      const user = await SeoUser.create({ name, email, password: await hashPassword(password), role: 'admin' });
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
      password: await hashPassword(pendingOtp.pendingSignupPassword),
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
    const rawIdentifier = String(req.body?.email || req.body?.loginId || '').trim();
    const email = normalizeEmail(rawIdentifier);
    const loginId = rawIdentifier.toLowerCase();
    const password = String(req.body?.password || '');
    const role = normalizeRole(req.body?.role);

    if (!rawIdentifier || !password || !role) {
      return res.status(400).json({ ok: false, error: 'Login ID / Email, password and role are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    const user = await SeoUser.findOne({
      $or: [
        { email: email },
        { loginId: loginId },
      ],
    });
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' });
    }

    const isPasswordValid = await passwordMatches(password, user.password);
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

    // ONLY Amit Kumar admin account bypasses OTP.
    // Everyone else MUST receive OTP on their registered email ID.
    const isAmitKumarAdmin = isAdminEmail(user.email) || user.email === 'amitkumaryadav8314@gmail.com';
    if (isAmitKumarAdmin) {
      return res.status(200).json({ ok: true, data: createAuthResponse(user, role) });
    }

    const userEmail = normalizeEmail(user.email);
    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

    // Store OTP indexed by both user.email AND raw input (email/loginId)
    await SeoAuthOtp.findOneAndUpdate(
      { email: userEmail, purpose: 'login' },
      {
        email: userEmail,
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

    await sendOtpEmail({ email: userEmail, otpCode, purpose: 'login' });
    return res.status(200).json({
      ok: true,
      data: {
        message: `OTP sent to your registered email (${userEmail})`,
        email: userEmail,
        expiresInSeconds: OTP_TTL_SECONDS,
      },
    });
  } catch (error) {
    console.error('[SEO][auth][requestLoginOtp] Error', error);
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Failed to send OTP' });
  }
}

async function verifyLoginOtp(req, res) {
  try {
    const rawIdentifier = String(req.body?.email || req.body?.loginId || '').trim();
    const email = normalizeEmail(rawIdentifier);
    const loginId = rawIdentifier.toLowerCase();
    const otpCode = String(req.body?.otp || '').trim();

    if (!rawIdentifier || !otpCode) {
      return res.status(400).json({ ok: false, error: 'Login ID / Email and OTP are required' });
    }

    // Try finding by exact email first, or lookup user by loginId
    let targetEmail = email;
    let pendingOtp = await SeoAuthOtp.findOne({ email: targetEmail, purpose: 'login' });
    if (!pendingOtp) {
      const user = await SeoUser.findOne({
        $or: [{ email: email }, { loginId: loginId }],
      });
      if (user && user.email) {
        targetEmail = normalizeEmail(user.email);
        pendingOtp = await SeoAuthOtp.findOne({ email: targetEmail, purpose: 'login' });
      }
    }
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

async function requestPasswordResetOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email is required' });
    }

    const user = await SeoUser.findOne({ email }).select('_id email').lean();
    if (!user) {
      return res.status(404).json({ ok: false, error: 'No SOI Panel account found with this email' });
    }

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
    await SeoAuthOtp.findOneAndUpdate(
      { email, purpose: 'reset' },
      {
        email,
        purpose: 'reset',
        otpCode,
        expiresAt,
        attemptsLeft: OTP_ATTEMPTS,
        pendingSignupName: '',
        pendingSignupPassword: '',
        pendingRole: 'seo',
        pendingLoginUserId: user._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Password recovery always requires OTP, including the Full Admin account.
    await sendOtpEmail({ email, otpCode, purpose: 'reset' });
    return res.status(200).json({
      ok: true,
      data: { message: 'Password reset OTP sent to your email', expiresInSeconds: OTP_TTL_SECONDS },
    });
  } catch (error) {
    console.error('[SEO][auth][requestPasswordResetOtp] Error', error);
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Failed to send password reset OTP' });
  }
}

async function resetPasswordWithOtp(req, res) {
  try {
    const email = normalizeEmail(req.body?.email);
    const otpCode = String(req.body?.otp || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !otpCode || !password) {
      return res.status(400).json({ ok: false, error: 'Email, OTP and new password are required' });
    }
    if (password.length < 10) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 10 characters' });
    }
    if (password.length > 128) {
      return res.status(400).json({ ok: false, error: 'Password is too long' });
    }

    const pendingOtp = await SeoAuthOtp.findOne({ email, purpose: 'reset' });
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

    const user = await SeoUser.findOne({ _id: pendingOtp.pendingLoginUserId, email });
    if (!user) {
      await pendingOtp.deleteOne();
      return res.status(404).json({ ok: false, error: 'Panel account not found' });
    }

    user.password = await hashPassword(password);
    await user.save();
    await SeoAuthOtp.deleteMany({ email, purpose: { $in: ['reset', 'login'] } });

    return res.status(200).json({
      ok: true,
      data: { message: 'Password reset successfully. You can now login with your new password.' },
    });
  } catch (error) {
    console.error('[SEO][auth][resetPasswordWithOtp] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to reset password' });
  }
}

async function listUsersForPanel(panelRole, res) {
  try {
    // Hide ghost super-admin (Amit Kumar / amitkumaryadav8314@gmail.com)
    // Filter strictly by panelRole: HR panel gets ONLY role 'hr', SEO panel gets ONLY role 'seo'
    const query = {
      email: { $ne: 'amitkumaryadav8314@gmail.com' },
      loginId: { $ne: 'admin' },
    };

    if (panelRole === 'hr') {
      query.role = 'hr';
    } else if (panelRole === 'seo') {
      query.$or = [{ role: 'seo' }, { role: { $exists: false } }];
    }

    const users = await SeoUser.find(query)
      .sort({ name: 1 })
      .lean();

    const result = users.map((user) => {
      const isAdm = Boolean(user.isAdministrator || user.role === 'admin');
      return {
        id: user._id,
        loginId: user.loginId || (user.email ? user.email.split('@')[0] : 'user'),
        name: user.name,
        email: user.email,
        role: user.role || 'hr',
        userType: isAdm ? 'Administrator' : (user.userType || 'Team Member'),
        status: user.status || 'Active',
        canManageTeam: Boolean(user.canManageTeam),
        isAdministrator: isAdm,
        recruiter: user.recruiter || '',
        workVisibility: Boolean(user.workVisibility),
        permissions: user.permissions || {},
        addedBy: user.addedBy || 'Administrator',
        createdAt: user.createdAt,
      };
    });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    console.error(`[SEO][auth][list${panelRole.toUpperCase()}Users] Error`, error);
    return res.status(500).json({ ok: false, error: 'Unable to load panel users' });
  }
}

function listSeoPanelUsers(_req, res) {
  return listUsersForPanel('seo', res);
}

function listHrPanelUsers(_req, res) {
  return listUsersForPanel('hr', res);
}

async function getCurrentProfile(req, res) {
  try {
    const userId = req.seoUser?.userId;
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const user = await SeoUser.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    const isAdm = Boolean(user.isAdministrator || user.role === 'admin' || isAdminEmail(user.email));
    return res.status(200).json({
      ok: true,
      data: {
        id: user._id,
        loginId: user.loginId || (user.email ? user.email.split('@')[0] : 'user'),
        name: user.name,
        email: user.email,
        role: getEffectiveRole(user),
        userType: isAdm ? 'Administrator' : (user.userType || 'Team Member'),
        status: user.status || 'Active',
        canManageTeam: Boolean(user.canManageTeam),
        isAdministrator: isAdm,
        recruiter: user.recruiter || '',
        workVisibility: Boolean(user.workVisibility),
        permissions: user.permissions || {},
        addedBy: user.addedBy || 'System',
      },
    });
  } catch (error) {
    console.error('[SEO][auth][getCurrentProfile] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to load profile' });
  }
}

async function createPanelMember(req, res) {
  try {
    const loginId = String(req.body?.loginId || '').trim().toLowerCase();
    const name = String(req.body?.name || req.body?.loginId || '').trim();
    const password = String(req.body?.password || '');
    const options = req.body?.options || {};
    const recruiter = String(req.body?.recruiter || '').trim();
    const workVisibility = Boolean(req.body?.workVisibility);
    const permissions = req.body?.permissions || {};
    const addedBy = req.seoUser?.email || 'Administrator';

    if (!loginId) {
      return res.status(400).json({ ok: false, error: 'Login ID is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    const email = loginId.includes('@') ? loginId.toLowerCase() : `${loginId}@seedsofinnocence.com`;

    // Check duplicate
    const existing = await SeoUser.findOne({
      $or: [{ loginId: loginId }, { email: email }],
    });
    if (existing) {
      return res.status(409).json({ ok: false, error: 'A user with this Login ID or Email already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const isAdministrator = Boolean(options.isAdministrator);
    const canManageTeam = Boolean(options.canManageTeam);
    const userType = isAdministrator ? 'Administrator' : 'Team Member';

    const newUser = await SeoUser.create({
      loginId,
      name: name || loginId,
      email,
      password: hashedPassword,
      role: 'hr',
      userType,
      status: 'Active',
      canManageTeam,
      isAdministrator,
      recruiter,
      workVisibility,
      permissions,
      addedBy,
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: newUser._id,
        loginId: newUser.loginId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        userType: newUser.userType,
        status: newUser.status,
        recruiter: newUser.recruiter,
        workVisibility: newUser.workVisibility,
        permissions: newUser.permissions,
        addedBy: newUser.addedBy,
      },
    });
  } catch (error) {
    console.error('[SEO][auth][createPanelMember] Error', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to create member' });
  }
}

async function updatePanelUser(req, res) {
  try {
    const userId = String(req.params?.userId || '').trim();
    const user = await SeoUser.findById(userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Panel user not found' });
    }

    // Protect primary Administrator
    const isProtected = user.isAdministrator || user.role === 'admin' || isAdminEmail(user.email);
    if (isProtected && req.seoUser?.email !== user.email && req.body?.isAdministrator === false) {
      return res.status(403).json({ ok: false, error: 'Administrator accounts are protected' });
    }

    if (req.body?.loginId) user.loginId = String(req.body.loginId).trim().toLowerCase();
    if (req.body?.name) user.name = String(req.body.name).trim();
    if (req.body?.email) user.email = normalizeEmail(req.body.email);
    if (req.body?.status) user.status = req.body.status;
    if (req.body?.userType) user.userType = req.body.userType;
    if (typeof req.body?.canManageTeam === 'boolean') user.canManageTeam = req.body.canManageTeam;
    if (typeof req.body?.isAdministrator === 'boolean') user.isAdministrator = req.body.isAdministrator;
    if (typeof req.body?.recruiter === 'string') user.recruiter = req.body.recruiter.trim();
    if (typeof req.body?.workVisibility === 'boolean') user.workVisibility = req.body.workVisibility;
    if (req.body?.permissions) {
      user.permissions = { ...(user.permissions || {}), ...req.body.permissions };
      user.markModified('permissions');
    }

    if (req.body?.password) {
      const password = String(req.body.password);
      if (password.length < 6) {
        return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
      }
      user.password = await hashPassword(password);
    }

    await user.save();

    return res.status(200).json({
      ok: true,
      data: {
        id: user._id,
        loginId: user.loginId,
        name: user.name,
        email: user.email,
        role: getEffectiveRole(user),
        userType: user.userType,
        status: user.status,
        canManageTeam: user.canManageTeam,
        isAdministrator: user.isAdministrator,
        recruiter: user.recruiter,
        workVisibility: user.workVisibility,
        permissions: user.permissions,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(404).json({ ok: false, error: 'Panel user not found' });
    }
    if (error?.code === 11000) {
      return res.status(409).json({ ok: false, error: 'Another user already uses this email' });
    }
    console.error('[SEO][auth][updatePanelUser] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to update panel user' });
  }
}

async function deletePanelUser(req, res) {
  try {
    const currentUserId = req.seoUser?.userId;
    const currentUserEmail = req.seoUser?.email;

    // Verify requesting user has 'full' access to users-access module or is Administrator
    const requester = await SeoUser.findById(currentUserId).lean();
    const isSuperAdmin =
      currentUserEmail === 'amitkumaryadav8314@gmail.com' ||
      requester?.role === 'admin' ||
      requester?.isAdministrator;

    const userAccessLevel = requester?.permissions?.['users-access'] || requester?.permissions?.usersAccess;
    const hasDeleteAccess = isSuperAdmin || userAccessLevel === 'full';

    if (!hasDeleteAccess) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: Full access to Users & Access is required to delete users',
      });
    }

    const userId = String(req.params?.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'Panel user is required' });
    }

    // Prevent deleting oneself
    if (String(currentUserId) === userId) {
      return res.status(400).json({ ok: false, error: 'You cannot delete your own account' });
    }

    // Protect super-admin and protected admin accounts
    const user = await SeoUser.findOne({
      _id: userId,
      role: { $ne: 'admin' },
      email: { $nin: Array.from(ADMIN_EMAILS) },
    });
    if (!user || user.isAdministrator) {
      return res.status(403).json({ ok: false, error: 'Protected administrator accounts cannot be deleted' });
    }

    await Promise.all([
      SeoAuthOtp.deleteMany({ email: user.email }),
      user.deleteOne(),
    ]);

    return res.status(200).json({
      ok: true,
      data: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    if (error?.name === 'CastError') {
      return res.status(404).json({ ok: false, error: 'Panel user not found' });
    }
    console.error('[SEO][auth][deletePanelUser] Error', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete panel user' });
  }
}

module.exports = {
  requestSignupOtp,
  verifySignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  listSeoPanelUsers,
  listHrPanelUsers,
  getCurrentProfile,
  createPanelMember,
  updatePanelUser,
  deletePanelUser,
};

const { UserSession } = require('../model/UserSession');

// Helper to calculate duration in seconds
function getDuration(start, end) {
  if (!start) return 0;
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((e - s) / 1000));
}

// POST /api/user-sessions/heartbeat
// Records or updates the user's active session
async function recordHeartbeat(req, res) {
  try {
    const user = req.seoUser || req.user;
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User not authenticated' });
    }

    const { sessionId } = req.body;
    const now = new Date();
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    let session = null;
    if (sessionId) {
      session = await UserSession.findById(sessionId);
    }

    // If session exists and is active, update lastActiveTime and duration
    if (session && session.status === 'Active') {
      session.lastActiveTime = now;
      session.durationSeconds = getDuration(session.loginTime, now);
      await session.save();
      return res.json({ ok: true, data: session });
    }

    // Check if user has an active session created within the last 30 minutes
    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);
    const userLoginId = user.loginId || user.email || user.username || '';
    session = await UserSession.findOne({
      loginId: userLoginId,
      status: 'Active',
      lastActiveTime: { $gte: recentCutoff },
    }).sort({ loginTime: -1 });

    if (session) {
      session.lastActiveTime = now;
      session.durationSeconds = getDuration(session.loginTime, now);
      await session.save();
      return res.json({ ok: true, data: session });
    }

    // Create new active session
    session = await UserSession.create({
      userId: user._id || user.id || null,
      loginId: userLoginId,
      userName: user.name || userLoginId,
      role: user.role || 'hr',
      loginTime: now,
      lastActiveTime: now,
      ipAddress: String(ip).slice(0, 50),
      userAgent: String(userAgent).slice(0, 200),
      durationSeconds: 0,
      status: 'Active',
    });

    return res.status(201).json({ ok: true, data: session });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// POST /api/user-sessions/logout
async function recordLogout(req, res) {
  try {
    const { sessionId } = req.body;
    const user = req.seoUser || req.user;
    const now = new Date();

    if (sessionId) {
      const session = await UserSession.findById(sessionId);
      if (session) {
        session.logoutTime = now;
        session.durationSeconds = getDuration(session.loginTime, now);
        session.status = 'Completed';
        await session.save();
        return res.json({ ok: true, message: 'Session logged out' });
      }
    }

    const userLoginId = user?.loginId || user?.email || user?.username;
    if (userLoginId) {
      await UserSession.updateMany(
        { loginId: userLoginId, status: 'Active' },
        {
          $set: {
            logoutTime: now,
            status: 'Completed',
          },
        }
      );
    }

    return res.json({ ok: true, message: 'Session ended' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// GET /api/user-sessions
// Returns sessions list with filtering by user, date, status
async function getUserSessions(req, res) {
  try {
    const { search, user, status, from, to } = req.query;

    const filter = {};

    // Auto-mark stale active sessions (no activity for 15 minutes) as Timed Out
    const staleTime = new Date(Date.now() - 15 * 60 * 1000);
    await UserSession.updateMany(
      { status: 'Active', lastActiveTime: { $lt: staleTime } },
      { $set: { status: 'Timed Out' } }
    );

    if (user && user !== 'All users') {
      filter.loginId = user;
    }

    if (status && status !== 'All statuses') {
      filter.status = status;
    }

    if (from || to) {
      filter.loginTime = {};
      if (from) {
        const f = new Date(from);
        f.setHours(0, 0, 0, 0);
        filter.loginTime.$gte = f;
      }
      if (to) {
        const t = new Date(to);
        t.setHours(23, 59, 59, 999);
        filter.loginTime.$lte = t;
      }
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ loginId: regex }, { userName: regex }, { ipAddress: regex }];
    }

    const sessions = await UserSession.find(filter)
      .sort({ loginTime: -1 })
      .limit(200)
      .lean();

    // Recalculate duration dynamically for Active sessions
    const now = Date.now();
    const enriched = sessions.map((s) => {
      let dur = s.durationSeconds || 0;
      if (s.status === 'Active') {
        dur = Math.max(0, Math.floor((now - new Date(s.loginTime).getTime()) / 1000));
      }
      return { ...s, durationSeconds: dur };
    });

    // Summary statistics
    const totalSessions = enriched.length;
    const activeSessions = enriched.filter((s) => s.status === 'Active').length;
    const totalDurationSeconds = enriched.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const avgDurationSeconds = totalSessions > 0 ? Math.round(totalDurationSeconds / totalSessions) : 0;

    return res.json({
      ok: true,
      data: enriched,
      stats: {
        totalSessions,
        activeSessions,
        totalDurationSeconds,
        avgDurationSeconds,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  recordHeartbeat,
  recordLogout,
  getUserSessions,
};

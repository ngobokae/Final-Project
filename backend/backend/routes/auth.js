import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../config/database.js';
import { generate2FAToken, generateToken, verifyToken } from '../config/auth.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';
import { getSetting } from '../utils/systemSettings.js';
import { registerUserSession } from '../utils/userPreferences.js';
import { ensureTotpColumns, generateTotpSecret, toQrDataUrl, verifyTotp } from '../utils/totp.js';

const ensurePasswordResetTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_token_hash (token_hash),
      INDEX idx_expires_at (expires_at)
    )
  `);
};

const sha256Hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const isTotpEnabled = (value) => value === true || value === 1 || value === '1' || value === 'true';
const isEmailVerified = (value) => {
  if (value === undefined || value === null) return true;
  return value === true || value === 1 || value === '1' || value === 'true';
};

const ensureEmailVerificationColumn = async () => {
  try {
    const cols = await query("SHOW COLUMNS FROM users LIKE 'email_verified'").catch(() => []);
    if (!Array.isArray(cols) || cols.length === 0) {
      await query('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1');
    }
  } catch (_) {
    // Non-fatal; login flow should not block users if this migration cannot run.
  }
};

export const handleLogin = async (req, res) => {
  try {
    const body = await parseBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const totp_code = body?.totp_code;

    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, 'Please enter a valid email address');
    }

    await ensureTotpColumns();
    await ensureEmailVerificationColumn();

    const users = await query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    
    if (users.length === 0) {
      return sendError(res, 401, 'Invalid credentials');
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      await logAudit(user.id, 'LOGIN_FAILED', 'auth', user.id, { email, reason: 'invalid_password' }, req).catch(() => {});
      return sendError(res, 401, 'Invalid credentials');
    }
    if (Object.prototype.hasOwnProperty.call(user, 'email_verified') && !isEmailVerified(user.email_verified)) {
      return sendError(res, 403, 'Email not verified. Please contact admin to verify your account email.');
    }

    const is2faEnabled = isTotpEnabled(user.totp_enabled);
    if (is2faEnabled) {
      if (!totp_code) {
        const tempToken = generate2FAToken(user);
        return sendJSON(res, 200, {
          success: false,
          requires2fa: true,
          tempToken,
          message: 'TOTP code required'
        });
      }

      const ok = verifyTotp({ secretBase32: user.totp_secret_base32, token: totp_code, window: 1 });
      if (!ok) {
        return sendError(res, 401, 'Invalid TOTP code');
      }
    }

    const token = generateToken(user);
    
    await logAudit(user.id, 'LOGIN', 'user', user.id, { email: user.email }, req);
    await registerUserSession(user.id, req).catch(() => {});

    sendJSON(res, 200, {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        theme: user.theme || 'light'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 500, 'Login failed');
  }
};

export const handleVerifyToken = async (req, res) => {
  try {
    // Token is already verified by middleware
    sendJSON(res, 200, {
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Token verification error:', error);
    sendError(res, 500, 'Token verification failed');
  }
};

export const handle2FASetup = async (req, res) => {
  try {
    await ensureTotpColumns();
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');

    const users = await query('SELECT id, email, name, totp_enabled FROM users WHERE id = ? LIMIT 1', [userId]).catch(() => []);
    if (!users.length) return sendError(res, 404, 'User not found');
    const user = users[0];
    if (isTotpEnabled(user.totp_enabled)) {
      return sendError(res, 400, '2FA is already enabled');
    }

    const siteName = (await getSetting('site_name', 'Kinglion')) || 'Kinglion';
    const label = `${siteName}:${user.email}`;
    const secret = generateTotpSecret({ label, issuer: siteName });

    await query('UPDATE users SET totp_pending_secret_base32 = ? WHERE id = ?', [secret.base32, userId]);

    const qrCodeDataUrl = await toQrDataUrl(secret.otpauth_url);

    sendJSON(res, 200, {
      success: true,
      issuer: siteName,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
      // show once to user; safe enough for admin UI
      secretBase32: secret.base32
    });
  } catch (e) {
    console.error('2FA setup error:', e);
    sendError(res, 500, e?.message || 'Failed to setup 2FA');
  }
};

export const handle2FAVerifyActivate = async (req, res) => {
  try {
    await ensureTotpColumns();
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');
    const body = await parseBody(req);
    const code = String(body?.code || '').trim();
    if (!code) return sendError(res, 400, 'code is required');

    const users = await query(
      'SELECT id, email, totp_pending_secret_base32, totp_enabled FROM users WHERE id = ? LIMIT 1',
      [userId]
    ).catch(() => []);
    if (!users.length) return sendError(res, 404, 'User not found');
    const user = users[0];
    if (isTotpEnabled(user.totp_enabled)) return sendError(res, 400, '2FA is already enabled');
    if (!user.totp_pending_secret_base32) return sendError(res, 400, 'No pending 2FA setup. Start setup first.');

    const ok = verifyTotp({ secretBase32: user.totp_pending_secret_base32, token: code, window: 1 });
    if (!ok) return sendError(res, 400, 'Invalid TOTP code');

    await query(
      'UPDATE users SET totp_secret_base32 = ?, totp_pending_secret_base32 = NULL, totp_enabled = 1, totp_enabled_at = NOW() WHERE id = ?',
      [user.totp_pending_secret_base32, userId]
    );

    await logAudit(userId, 'ENABLE_2FA_TOTP', 'user', userId, { email: user.email }, req).catch(() => {});

    sendJSON(res, 200, { success: true, message: '2FA enabled' });
  } catch (e) {
    console.error('2FA activate error:', e);
    sendError(res, 500, e?.message || 'Failed to activate 2FA');
  }
};

export const handle2FADisable = async (req, res) => {
  try {
    await ensureTotpColumns();
    const userId = req.user?.id;
    if (!userId) return sendError(res, 401, 'Unauthorized');

    const users = await query(
      'SELECT id, email, totp_enabled FROM users WHERE id = ? LIMIT 1',
      [userId]
    ).catch(() => []);
    if (!users.length) return sendError(res, 404, 'User not found');
    const user = users[0];
    if (!isTotpEnabled(user.totp_enabled)) return sendError(res, 400, '2FA is already disabled');

    await query(
      `
        UPDATE users
        SET totp_enabled = 0,
            totp_enabled_at = NULL,
            totp_secret_base32 = NULL,
            totp_pending_secret_base32 = NULL
        WHERE id = ?
      `,
      [userId]
    );

    await logAudit(userId, 'DISABLE_2FA_TOTP', 'user', userId, { email: user.email }, req).catch(() => {});
    sendJSON(res, 200, { success: true, message: '2FA disabled' });
  } catch (e) {
    console.error('2FA disable error:', e);
    sendError(res, 500, e?.message || 'Failed to disable 2FA');
  }
};

export const handle2FALoginVerify = async (req, res) => {
  try {
    await ensureTotpColumns();
    const body = await parseBody(req);
    const tempToken = String(body?.tempToken || '').trim();
    const code = String(body?.code || '').trim();
    if (!tempToken || !code) return sendError(res, 400, 'tempToken and code are required');

    const claims = verifyToken(tempToken);
    if (!claims || claims.purpose !== '2fa' || !claims.id) return sendError(res, 401, 'Invalid temp token');

    const users = await query('SELECT * FROM users WHERE id = ? AND is_active = TRUE LIMIT 1', [claims.id]).catch(() => []);
    if (!users.length) return sendError(res, 401, 'Invalid session');
    const user = users[0];
    if (!isTotpEnabled(user.totp_enabled) || !user.totp_secret_base32) {
      return sendError(res, 400, '2FA not enabled for user');
    }

    const ok = verifyTotp({ secretBase32: user.totp_secret_base32, token: code, window: 1 });
    if (!ok) return sendError(res, 401, 'Invalid TOTP code');

    const token = generateToken(user);
    await logAudit(user.id, 'LOGIN_2FA', 'user', user.id, { email: user.email }, req).catch(() => {});
    await registerUserSession(user.id, req).catch(() => {});

    sendJSON(res, 200, {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        theme: user.theme || 'light'
      }
    });
  } catch (e) {
    console.error('2FA login verify error:', e);
    sendError(res, 500, e?.message || 'Failed to verify 2FA');
  }
};

export const handleForgotPassword = async (req, res) => {
  try {
    const body = await parseBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!email) return sendError(res, 400, 'Email is required');

    await ensurePasswordResetTable();

    // Always respond success to avoid account enumeration
    const users = await query('SELECT id, email, name FROM users WHERE email = ? AND is_active = TRUE LIMIT 1', [email]).catch(() => []);
    if (!users.length) {
      return sendJSON(res, 200, { success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const user = users[0];
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const expiresSql = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // Invalidate older tokens for this user
    await query('UPDATE password_resets SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]).catch(() => {});

    await query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresSql]
    );

    const siteName = (await getSetting('site_name', 'Kinglion')) || 'Kinglion';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="background:#f6f6f6;padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
          <tr>
            <td style="background:linear-gradient(90deg,#0a0a0a,#7f1d1d);padding:18px 20px;">
              <div style="font-family:Arial,sans-serif;color:#fff;font-size:18px;font-weight:800;">${siteName}</div>
              <div style="font-family:Arial,sans-serif;color:rgba(255,255,255,.85);font-size:12px;margin-top:4px;">Password reset</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px;font-family:Arial,sans-serif;color:#111;">
              <div style="font-size:14px;color:#333;line-height:1.5;">
                Hi ${user.name ? String(user.name) : 'there'},<br/><br/>
                We received a request to reset your password. Click the button below to set a new password.
              </div>
              <div style="margin-top:16px;">
                <a href="${resetLink}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-family:Arial,sans-serif;font-weight:700;">
                  Reset password
                </a>
              </div>
              <div style="margin-top:12px;font-size:12px;color:#666;line-height:1.45;">
                This link expires in 1 hour. If you didn’t request this, you can ignore this email.
              </div>
              <div style="margin-top:10px;font-size:11px;color:#888;word-break:break-all;">
                Or copy/paste this link: ${resetLink}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 20px;background:#fafafa;border-top:1px solid #eee;font-family:Arial,sans-serif;font-size:11px;color:#777;">
              Sent by ${siteName}. This is an automated email.
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: `${siteName} · Reset your password`,
      html,
      text: `Reset your password using this link (expires in 1 hour): ${resetLink}`
    });

    await logAudit(user.id, 'FORGOT_PASSWORD', 'user', user.id, { email }, req).catch(() => {});

    return sendJSON(res, 200, { success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    sendError(res, 500, error?.message || 'Failed to start password reset');
  }
};

export const handleResetPassword = async (req, res) => {
  try {
    const body = await parseBody(req);
    const email = String(body?.email || '').trim().toLowerCase();
    const token = String(body?.token || '').trim();
    const newPassword = String(body?.new_password || '').trim();

    if (!email || !token || !newPassword) {
      return sendError(res, 400, 'Required: email, token, new_password');
    }
    if (newPassword.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters');
    }

    await ensurePasswordResetTable();

    const users = await query('SELECT id, email, name FROM users WHERE email = ? AND is_active = TRUE LIMIT 1', [email]).catch(() => []);
    if (!users.length) return sendError(res, 400, 'Invalid or expired token');
    const user = users[0];

    const tokenHash = sha256Hex(token);
    const rows = await query(
      `
        SELECT id
        FROM password_resets
        WHERE user_id = ?
          AND token_hash = ?
          AND used_at IS NULL
          AND expires_at >= NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [user.id, tokenHash]
    ).catch(() => []);

    if (!rows.length) return sendError(res, 400, 'Invalid or expired token');
    const resetRow = rows[0];

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
    await query('UPDATE password_resets SET used_at = NOW() WHERE id = ?', [resetRow.id]);

    await logAudit(user.id, 'RESET_PASSWORD', 'user', user.id, { email }, req).catch(() => {});

    sendJSON(res, 200, { success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    sendError(res, 500, error?.message || 'Failed to reset password');
  }
};

import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError, parseQuery } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import { getUserPermissions } from '../utils/permissions.js';
import { ensureTotpColumns, verifyTotp } from '../utils/totp.js';
import {
  getUserPreferences,
  saveUserPreferences,
  parseUserAgent,
} from '../utils/userPreferences.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isTotpEnabled = (value) => value === true || value === 1 || value === '1' || value === 'true';

export const handleGetMe = async (req, res) => {
  try {
    const users = await query(
      'SELECT id, email, name, role, created_at, COALESCE(theme, \'light\') as theme, COALESCE(totp_enabled, 0) as totp_enabled FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return sendError(res, 404, 'User not found');
    }
    sendJSON(res, 200, users[0]);
  } catch (error) {
    console.error('Get me error:', error);
    sendError(res, 500, 'Failed to fetch profile');
  }
};

export const handleUpdateMe = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { name, email, theme } = body;
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return sendError(res, 400, 'Please enter a valid email address');
      }
      updates.push('email = ?');
      values.push(normalizedEmail);
    }
    if (theme !== undefined && ['light', 'dark'].includes(theme)) {
      updates.push('theme = ?');
      values.push(theme);
    }
    if (updates.length === 0) {
      return sendError(res, 400, 'No fields to update');
    }
    values.push(req.user.id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    await logAudit(req.user.id, 'UPDATE_PROFILE', 'user', req.user.id, { name, email, theme }, req);
    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Update me error:', error);
    sendError(res, 500, 'Failed to update profile');
  }
};

export const handleUpdateMyPassword = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { currentPassword, newPassword, totpCode } = body;
    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Current and new password are required');
    }
    await ensureTotpColumns();
    const users = await query('SELECT password_hash, totp_enabled, totp_secret_base32 FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return sendError(res, 404, 'User not found');
    }
    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) {
      return sendError(res, 401, 'Current password is incorrect');
    }
    if (isTotpEnabled(users[0].totp_enabled)) {
      const code = String(totpCode || '').trim();
      if (!code) {
        return sendError(res, 400, '2FA code is required to change password');
      }
      const ok = verifyTotp({ secretBase32: users[0].totp_secret_base32, token: code, window: 1 });
      if (!ok) {
        return sendError(res, 401, 'Invalid 2FA code');
      }
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    await logAudit(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, { passwordChanged: true, used2fa: isTotpEnabled(users[0].totp_enabled) }, req);
    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Update password error:', error);
    sendError(res, 500, 'Failed to change password');
  }
};

export const handleGetUsersForMessaging = async (req, res) => {
  try {
    const users = await query(
      'SELECT id, email, name, role FROM users WHERE is_active = TRUE AND id != ? ORDER BY name',
      [req.user.id]
    );
    sendJSON(res, 200, { users: users || [] });
  } catch (error) {
    console.error('Get users for messaging error:', error);
    sendError(res, 500, 'Failed to fetch users');
  }
};

export const handleGetUsers = async (req, res) => {
  try {
    const queryParams = req.query || {};
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit) || 10));
    const offset = (page - 1) * limit;

    const users = await query(
      `SELECT id, email, name, role, is_active, created_at FROM users ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
    );

    const [countResult] = await query('SELECT COUNT(*) as total FROM users');
    const total = countResult.total;

    sendJSON(res, 200, {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    sendError(res, 500, 'Failed to fetch users');
  }
};

export const handleGetUserPermissions = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const userId = parseInt(urlParts[urlParts.length - 2]);
    
    if (isNaN(userId)) {
      return sendError(res, 400, 'Invalid user ID');
    }

    // Check if user exists
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return sendError(res, 404, 'User not found');
    }

    // Get user permissions using utility function
    const permissions = await getUserPermissions(userId);

    sendJSON(res, 200, { permissions });
  } catch (error) {
    console.error('Get user permissions error:', error);
    sendError(res, 500, 'Failed to fetch user permissions');
  }
};

export const handleUpdateUserPermissions = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const userId = parseInt(urlParts[urlParts.length - 2]);
    
    if (isNaN(userId)) {
      return sendError(res, 400, 'Invalid user ID');
    }

    // Check if user exists
    const users = await query('SELECT id FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return sendError(res, 404, 'User not found');
    }

    const body = await parseBody(req);
    const { permissions } = body;

    if (!permissions || typeof permissions !== 'object') {
      return sendError(res, 400, 'Invalid permissions format');
    }

    // Delete existing permissions for this user
    await query('DELETE FROM user_permissions WHERE user_id = ?', [userId]);

    // Insert new permissions.
    // IMPORTANT: we only persist non-empty action arrays.
    // Empty arrays mean "no override" so role-based defaults still apply.
    for (const [resource, actions] of Object.entries(permissions)) {
      if (!Array.isArray(actions) || actions.length === 0) continue;

      await query(
        'INSERT INTO user_permissions (user_id, resource, actions) VALUES (?, ?, ?)',
        [userId, resource, JSON.stringify(actions)]
      );
    }

    await logAudit(req.user.id, 'UPDATE_USER_PERMISSIONS', 'user', userId, { permissions }, req);

    sendJSON(res, 200, { success: true, message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update user permissions error:', error);
    sendError(res, 500, 'Failed to update user permissions');
  }
};

export const handleCreateUser = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { password, name, role } = body;
    const email = String(body?.email || '').trim().toLowerCase();

    if (!email || !password || !name || !role) {
      return sendError(res, 400, 'All fields are required');
    }
    if (!EMAIL_REGEX.test(email)) {
      return sendError(res, 400, 'Please enter a valid email address');
    }

    if (!['admin', 'operations', 'inventory', 'executive'].includes(role)) {
      return sendError(res, 400, 'Invalid role');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
      [email, passwordHash, name, role]
    );

    await logAudit(req.user.id, 'CREATE_USER', 'user', result.insertId, { email, role }, req);

    sendJSON(res, 201, {
      success: true,
      user: {
        id: result.insertId,
        email,
        name,
        role
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return sendError(res, 409, 'Email already exists');
    }
    console.error('Create user error:', error);
    sendError(res, 500, 'Failed to create user');
  }
};

export const handleUpdateUser = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const userId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(userId)) {
      return sendError(res, 400, 'Invalid user ID');
    }

    const body = await parseBody(req);
    const { email, name, role, is_active, password } = body;

    const updates = [];
    const values = [];

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return sendError(res, 400, 'Please enter a valid email address');
      }
      updates.push('email = ?');
      values.push(normalizedEmail);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (role !== undefined) {
      if (!['admin', 'operations', 'inventory', 'executive'].includes(role)) {
        return sendError(res, 400, 'Invalid role');
      }
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    // Update password_hash when a new password is provided
    if (password && typeof password === 'string' && password.trim()) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      updates.push('password_hash = ?');
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return sendError(res, 400, 'No fields to update');
    }

    values.push(userId);
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const auditBody = { ...body };
    if (auditBody.password) delete auditBody.password;
    if (password && password.trim()) auditBody.passwordChanged = true;
    await logAudit(req.user.id, 'UPDATE_USER', 'user', userId, auditBody, req);

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Update user error:', error);
    sendError(res, 500, 'Failed to update user');
  }
};

export const handleGetMyPreferences = async (req, res) => {
  try {
    const prefs = await getUserPreferences(req.user.id);
    const { sessions, ...safe } = prefs;
    sendJSON(res, 200, { preferences: safe });
  } catch (error) {
    console.error('Get preferences error:', error);
    sendError(res, 500, 'Failed to fetch preferences');
  }
};

export const handleUpdateMyPreferences = async (req, res) => {
  try {
    const body = await parseBody(req);
    const allowed = [
      'email_notifications',
      'alert_uploads',
      'alert_inventory',
      'alert_forecast_failures',
      'digest',
      'avatar_color',
    ];
    const patch = {};
    for (const key of allowed) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const preferences = await saveUserPreferences(req.user.id, patch);
    const { sessions, ...safe } = preferences;
    sendJSON(res, 200, { success: true, preferences: safe });
  } catch (error) {
    console.error('Update preferences error:', error);
    sendError(res, 500, 'Failed to update preferences');
  }
};

export const handleGetMyActivity = async (req, res) => {
  try {
    const logs = await query(
      `
        SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at
        FROM audit_logs a
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC
        LIMIT 5
      `,
      [req.user.id]
    );
    sendJSON(res, 200, { activity: logs || [] });
  } catch (error) {
    console.error('Get my activity error:', error);
    sendError(res, 500, 'Failed to fetch activity');
  }
};

export const handleGetMyLoginHistory = async (req, res) => {
  try {
    const logs = await query(
      `
        SELECT a.id, a.action, a.ip_address, a.user_agent, a.created_at, a.details
        FROM audit_logs a
        WHERE a.user_id = ? AND a.action IN ('LOGIN', 'LOGIN_2FA', 'LOGIN_FAILED')
        ORDER BY a.created_at DESC
        LIMIT 25
      `,
      [req.user.id]
    );
    sendJSON(res, 200, {
      logins: (logs || []).map((row) => ({
        ...row,
        device: parseUserAgent(row.user_agent),
      })),
    });
  } catch (error) {
    console.error('Get login history error:', error);
    sendError(res, 500, 'Failed to fetch login history');
  }
};

export const handleGetMySessions = async (req, res) => {
  try {
    const prefs = await getUserPreferences(req.user.id);
    const currentUa = req?.headers['user-agent'] || '';
    const sessions = (prefs.sessions || []).map((s) => ({
      ...s,
      current: s.userAgent === currentUa || s.current === true,
    }));
    if (!sessions.length) {
      const ip = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null;
      sessions.push({
        id: 'current',
        device: parseUserAgent(currentUa),
        ip: typeof ip === 'string' ? ip.replace('::ffff:', '') : ip,
        lastActive: new Date().toISOString(),
        current: true,
      });
    }
    sendJSON(res, 200, { sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    sendError(res, 500, 'Failed to fetch sessions');
  }
};

export const handleRevokeOtherSessions = async (req, res) => {
  try {
    const prefs = await getUserPreferences(req.user.id);
    const currentUa = req?.headers['user-agent'] || '';
    const sessions = (prefs.sessions || []).filter(
      (s) => s.userAgent === currentUa || s.current === true
    );
    await saveUserPreferences(req.user.id, { sessions });
    sendJSON(res, 200, { success: true, message: 'Other sessions cleared', sessions });
  } catch (error) {
    console.error('Revoke sessions error:', error);
    sendError(res, 500, 'Failed to revoke sessions');
  }
};

export const handleDeleteUser = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const userId = parseInt(urlParts[urlParts.length - 1]);
    
    if (isNaN(userId)) {
      return sendError(res, 400, 'Invalid user ID');
    }

    await query('DELETE FROM users WHERE id = ?', [userId]);

    await logAudit(req.user.id, 'DELETE_USER', 'user', userId, null, req);

    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    sendError(res, 500, 'Failed to delete user');
  }
};

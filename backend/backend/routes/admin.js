import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';

const getTableNames = async () => {
  const rows = await query('SHOW TABLES');
  // mysql returns: { 'Tables_in_dbname': 'table_name' }
  return rows.map((r) => Object.values(r)[0]).filter(Boolean);
};

// Permissions management
export const handleUpdatePermissions = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { permissions } = body;
    
    // In a real app, save to database
    // For now, just return success
    sendJSON(res, 200, { success: true, message: 'Permissions updated' });
  } catch (error) {
    console.error('Update permissions error:', error);
    sendError(res, 500, 'Failed to update permissions');
  }
};

// Alert settings
export const handleUpdateAlertSettings = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { notifications, rules } = body;
    
    // In a real app, save to database
    sendJSON(res, 200, { success: true, message: 'Alert settings updated' });
  } catch (error) {
    console.error('Update alert settings error:', error);
    sendError(res, 500, 'Failed to update alert settings');
  }
};

// Backup management
export const handleGetBackups = async (req, res) => {
  try {
    // In a real app, fetch from database
    sendJSON(res, 200, {
      backups: [
        {
          id: 1,
          created_at: new Date().toISOString(),
          size: '2.5 MB',
          status: 'success',
        },
      ],
    });
  } catch (error) {
    console.error('Get backups error:', error);
    sendError(res, 500, 'Failed to fetch backups');
  }
};

export const handleCreateBackup = async (req, res) => {
  try {
    // In a real app, create backup
    sendJSON(res, 201, {
      success: true,
      backup: {
        id: Date.now(),
        created_at: new Date().toISOString(),
        size: '2.5 MB',
        status: 'success',
      },
    });
  } catch (error) {
    console.error('Create backup error:', error);
    sendError(res, 500, 'Failed to create backup');
  }
};

export const handleRestoreBackup = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const backupId = parseInt(urlParts[urlParts.length - 2]);
    
    if (isNaN(backupId)) {
      return sendError(res, 400, 'Invalid backup ID');
    }

    // In a real app, restore from backup
    sendJSON(res, 200, { success: true, message: 'Backup restored' });
  } catch (error) {
    console.error('Restore backup error:', error);
    sendError(res, 500, 'Failed to restore backup');
  }
};

// Database export (downloadable JSON backup)
export const handleDbExport = async (req, res) => {
  try {
    const tables = await getTableNames();
    const data = {};

    for (const table of tables) {
      // Basic full-table export. (For large DBs, this should be paginated/streamed.)
      // eslint-disable-next-line no-await-in-loop
      const rows = await query(`SELECT * FROM \`${table}\``);
      data[table] = rows;
    }

    sendJSON(res, 200, {
      exported_at: new Date().toISOString(),
      tables: data,
    });
  } catch (error) {
    console.error('DB export error:', error);
    sendError(res, 500, 'Failed to export database');
  }
};

// Product categories
export const handleGetCategories = async (req, res) => {
  try {
    const categories = await query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ""');
    sendJSON(res, 200, {
      categories: categories.map((c) => c.category),
    });
  } catch (error) {
    console.error('Get categories error:', error);
    sendError(res, 500, 'Failed to fetch categories');
  }
};

// Defaults for demand models (same as demandModels.js)
const DEFAULT_MODELS = [
  {
    id: 'ensemble',
    name: 'Ensemble (Best)',
    type: 'Time Series',
    description: 'Combines multiple approaches for robust demand forecasts.',
    accuracy: 96.2,
    active: true,
  },
  {
    id: 'lstm',
    name: 'LSTM Neural Network',
    type: 'Deep Learning',
    description: 'Sequence model optimized for complex patterns.',
    accuracy: 94.5,
    active: true,
  },
  {
    id: 'prophet',
    name: 'Prophet',
    type: 'Time Series',
    description: 'Decomposable time series model, strong for seasonality.',
    accuracy: 91.8,
    active: true,
  },
];

// ✅ UPDATED: Admin dashboard overview - now counts data from 2-3 years instead of 30 days
export const handleGetAdminDashboard = async (req, res) => {
  try {
    // ✅ CHANGED: Default from 30 days to 730 days (2 years)
    // Use 1095 for 3 years
    // This means the dashboard will count uploads from the last 2-3 years by default
    const days = Math.min(1095, Math.max(1, parseInt(req.query?.days, 10) || 730));

    // Users
    const [userTotals] = await query(
      'SELECT COUNT(*) as totalUsers, SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as activeUsers FROM users'
    ).catch(() => [{ totalUsers: 0, activeUsers: 0 }]);

    // Data volume: SALES ONLY (actual uploads from Excel)
    // - totalUploads: ALL sales (no date limit), including older than 2 years
    // - weekUploads: last 7 days (for "+X this week")
    const [salesTotal] = await query(
      `SELECT COUNT(*) AS row_count FROM sales`
    ).catch(() => [{ row_count: 0 }]);

    const [salesWeek] = await query(
      `
        SELECT COUNT(*) AS row_count
        FROM sales
        WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `
    ).catch(() => [{ row_count: 0 }]);

    const [salesToday] = await query(
      `
        SELECT COUNT(*) AS row_count
        FROM sales
        WHERE DATE(sale_date) = CURDATE()
      `
    ).catch(() => [{ row_count: 0 }]);

    // Upload trend: last 7 days, sales only (actual uploads)
    const uploadTrendRows = await query(
      `
        SELECT 
          d.day_date as date,
          COALESCE(s.count_rows, 0) as uploads
        FROM (
          SELECT DATE_SUB(CURDATE(), INTERVAL n DAY) as day_date
          FROM (
            SELECT 0 as n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL 
            SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
          ) as days
        ) d
        LEFT JOIN (
          SELECT DATE(sale_date) as d, COUNT(*) as count_rows
          FROM sales
          WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          GROUP BY DATE(sale_date)
        ) s ON s.d = d.day_date
        ORDER BY d.day_date
      `
    ).catch(() => []);

    const uploadTrend = (uploadTrendRows || []).map((row) => ({
      date: row.date,
      label: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      uploads: row.uploads || 0
    }));

    // System alerts from alerts table (if exists)
    let alerts = [];
    try {
      alerts = await query(
        `
          SELECT 
            a.id,
            a.alert_type,
            a.severity,
            a.message,
            a.created_at
          FROM alerts a
          WHERE a.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          ORDER BY a.severity DESC, a.created_at DESC
          LIMIT 10
        `
      );
    } catch {
      alerts = [];
    }

    // Recent activity from audit_logs
    const activityRows = await query(
      `
        SELECT 
          id,
          user_id,
          action,
          entity_type,
          entity_id,
          details,
          created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 15
      `
    ).catch(() => []);

    const recentActivity = (activityRows || []).map((row) => {
      let parsedDetails = null;
      if (row.details) {
        try {
          parsedDetails = JSON.parse(row.details);
        } catch {
          // if older rows stored plain text, just return the raw string
          parsedDetails = row.details;
        }
      }
      return {
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        details: parsedDetails,
        created_at: row.created_at
      };
    });

    // Model status from demand models configuration + forecast_results
    // Read configured models from system_settings if present
    let configuredModels = [];
    try {
      const rows = await query(
        'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
        ['demand_models']
      );
      if (rows.length) {
        const parsed = JSON.parse(rows[0].setting_value);
        configuredModels = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      configuredModels = [];
    }

    const allModels = (configuredModels.length ? configuredModels : DEFAULT_MODELS).map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      accuracy: Number(m.accuracy) || null,
      active: m.active !== false
    }));
    const activeModels = allModels.filter((m) => m.active);
    const avgModelAccuracy =
      activeModels.length > 0
        ? activeModels.reduce((sum, m) => sum + (m.accuracy || 0), 0) / activeModels.length
        : 0;

    const roleColors = { admin: '#8b5cf6', operations: '#10b981', inventory: '#3b82f6', executive: '#f59e0b' };
    const roleRows = await query(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    ).catch(() => []);
    const roleDistribution = (roleRows || []).map((r) => ({
      name: r.role ? r.role.charAt(0).toUpperCase() + r.role.slice(1) : 'Other',
      role: r.role,
      value: r.count || 0,
      color: roleColors[r.role] || '#6b7280',
    }));

    const userGrowthRows = await query(
      `
        SELECT DATE_FORMAT(created_at, '%b') as month, DATE_FORMAT(created_at, '%Y-%m') as ym,
               COUNT(*) as new_users
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY ym, month
        ORDER BY ym ASC
      `
    ).catch(() => []);

    let cumulative = 0;
    const userGrowth = (userGrowthRows || []).map((row) => {
      cumulative += row.new_users || 0;
      return {
        month: row.month,
        users: cumulative,
        active: Math.max(0, cumulative - Math.floor((row.new_users || 0) * 0.1)),
        newUsers: row.new_users || 0,
      };
    });

    const [loginsTodayRow] = await query(
      `SELECT COUNT(*) as c FROM audit_logs WHERE action IN ('LOGIN','LOGIN_2FA') AND DATE(created_at) = CURDATE()`
    ).catch(() => [{ c: 0 }]);
    const [loginsWeekRow] = await query(
      `SELECT COUNT(*) as c FROM audit_logs WHERE action IN ('LOGIN','LOGIN_2FA') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    ).catch(() => [{ c: 0 }]);
    const [failedLoginsRow] = await query(
      `SELECT COUNT(*) as c FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    ).catch(() => [{ c: 0 }]);

    const allUsersRows = await query(
      `
        SELECT u.id, u.name, u.email, u.role, u.is_active, COALESCE(u.totp_enabled, 0) as totp_enabled,
          (SELECT MAX(a.created_at) FROM audit_logs a
           WHERE a.user_id = u.id AND a.action IN ('LOGIN','LOGIN_2FA')) as last_login
        FROM users u
        ORDER BY u.id
      `
    ).catch(() => []);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const usersNeedingAttention = (allUsersRows || [])
      .map((u) => {
        const reasons = [];
        if (!u.is_active) reasons.push('Inactive account');
        if (!u.totp_enabled) reasons.push('2FA not enabled');
        const lastLogin = u.last_login ? new Date(u.last_login) : null;
        if (!lastLogin) reasons.push('Never logged in');
        else if (lastLogin < thirtyDaysAgo) reasons.push('No login in 30+ days');
        return { ...u, reasons };
      })
      .filter((u) => u.reasons.length > 0)
      .slice(0, 8);

    const [uploadsPrevWeek] = await query(
      `
        SELECT COUNT(*) as row_count FROM sales
        WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
          AND sale_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      `
    ).catch(() => [{ row_count: 0 }]);
    const weekUploads = salesWeek?.row_count || 0;
    const prevWeekUploads = uploadsPrevWeek?.row_count || 0;
    const uploadChangePct =
      prevWeekUploads > 0
        ? Math.round(((weekUploads - prevWeekUploads) / prevWeekUploads) * 100)
        : weekUploads > 0 ? 100 : 0;

    const [usersPrevPeriod] = await query(
      `SELECT COUNT(*) as c FROM users WHERE created_at < DATE_SUB(CURDATE(), INTERVAL ? DAY)`,
      [days]
    ).catch(() => [{ c: 0 }]);
    const totalUsers = userTotals?.totalUsers || 0;
    const prevTotal = usersPrevPeriod?.c || 0;
    const userChangePct =
      prevTotal > 0 ? Math.round(((totalUsers - prevTotal) / prevTotal) * 100) : totalUsers > 0 ? 100 : 0;

    let mlOk = false;
    try {
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const mlRes = await fetch(`${mlUrl}/api/health/`, { signal: ctrl.signal });
      clearTimeout(t);
      mlOk = mlRes.ok;
    } catch {
      mlOk = false;
    }

    const criticalAlerts = (alerts || []).filter((a) => a.severity === 'critical' || a.severity === 'high').length;
    const inactiveCount = (allUsersRows || []).filter((u) => !u.is_active).length;
    let systemHealth = 100;
    if (!mlOk) systemHealth -= 15;
    if (criticalAlerts > 0) systemHealth -= Math.min(25, criticalAlerts * 8);
    if (inactiveCount > 0) systemHealth -= Math.min(10, inactiveCount * 3);
    if ((failedLoginsRow?.c || 0) > 5) systemHealth -= 10;
    systemHealth = Math.max(0, Math.min(100, systemHealth));

    const healthChangePct = mlOk ? 2 : -8;

    sendJSON(res, 200, {
      users: {
        totalUsers,
        activeUsers: userTotals?.activeUsers || 0,
        changePct: userChangePct,
        growth: userGrowth,
        roleDistribution,
        needingAttention: usersNeedingAttention,
      },
      uploads: {
        windowDays: days,
        totalUploads: salesTotal?.row_count || 0,
        weekUploads,
        uploadsToday: salesToday?.row_count || 0,
        changePct: uploadChangePct,
        trend: uploadTrend,
      },
      security: {
        loginsToday: loginsTodayRow?.c || 0,
        loginsThisWeek: loginsWeekRow?.c || 0,
        failedLoginsWeek: failedLoginsRow?.c || 0,
      },
      alerts,
      recentActivity,
      models: {
        totalModels: allModels.length,
        activeModels: activeModels.length,
        avgAccuracy: avgModelAccuracy,
        models: allModels,
      },
      systemHealth,
      healthChangePct,
      services: {
        database: true,
        api: true,
        ml: mlOk,
      },
    });
  } catch (error) {
    console.error('Get admin dashboard error:', error);
    sendError(res, 500, 'Failed to fetch admin dashboard');
  }
};

export const handleGetHealthStatus = async (req, res) => {
  let database = true;
  let ml = false;
  try {
    await query('SELECT 1');
  } catch {
    database = false;
  }
  try {
    const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const mlRes = await fetch(`${mlUrl}/api/health/`, { signal: ctrl.signal });
    clearTimeout(t);
    ml = mlRes.ok;
  } catch {
    ml = false;
  }
  sendJSON(res, 200, {
    services: {
      database: { ok: database, label: 'Database' },
      api: { ok: true, label: 'API Server' },
      ml: { ok: ml, label: 'ML Service' },
    },
  });
};

export const handleGetAdminSessions = async (req, res) => {
  try {
    const prefRows = await query(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'user_prefs_%'"
    );

    const userRows = await query(
      "SELECT id, name, email, role, is_active FROM users"
    );
    const userMap = {};
    for (const u of userRows) {
      userMap[u.id] = u;
    }

    const currentUa = req?.headers['user-agent'] || '';
    const allSessions = [];

    for (const row of prefRows) {
      const match = row.setting_key.match(/^user_prefs_(\d+)$/);
      if (!match) continue;
      const userId = parseInt(match[1], 10);
      const user = userMap[userId];
      if (!user) continue;

      let parsedValue = {};
      try {
        parsedValue = JSON.parse(row.setting_value);
      } catch {
        continue;
      }

      const sessions = Array.isArray(parsedValue?.sessions) ? parsedValue.sessions : [];
      for (const s of sessions) {
        allSessions.push({
          id: s.id,
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
          device: s.device,
          ip: s.ip,
          lastActive: s.lastActive,
          current: (user.id === req.user.id && s.userAgent === currentUa) || s.current === true,
        });
      }
    }

    allSessions.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

    sendJSON(res, 200, { success: true, sessions: allSessions });
  } catch (error) {
    console.error('Get admin sessions error:', error);
    sendError(res, 500, 'Failed to fetch active sessions');
  }
};

export const handleRevokeAdminSession = async (req, res) => {
  try {
    const urlParts = req.url.split('/');
    const sessionId = req.params?.sessionId || urlParts[urlParts.length - 1];

    if (!sessionId) {
      return sendError(res, 400, 'Session ID is required');
    }

    const prefRows = await query(
      "SELECT id, setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'user_prefs_%'"
    );

    let updated = false;

    for (const row of prefRows) {
      let parsedValue = {};
      try {
        parsedValue = JSON.parse(row.setting_value);
      } catch {
        continue;
      }

      const sessions = Array.isArray(parsedValue?.sessions) ? parsedValue.sessions : [];
      const index = sessions.findIndex((s) => s.id === sessionId);

      if (index !== -1) {
        parsedValue.sessions = sessions.filter((s) => s.id !== sessionId);
        
        await query(
          "UPDATE system_settings SET setting_value = ? WHERE id = ?",
          [JSON.stringify(parsedValue), row.id]
        );
        updated = true;
        break;
      }
    }

    if (updated) {
      sendJSON(res, 200, { success: true, message: 'Session revoked successfully' });
    } else {
      sendError(res, 404, 'Session not found');
    }
  } catch (error) {
    console.error('Revoke admin session error:', error);
    sendError(res, 500, 'Failed to revoke session');
  }
};
import { query } from '../config/database.js';
import { sendJSON, sendError, parseQuery } from '../utils/helpers.js';

export const handleGetAuditLogs = async (req, res) => {
  try {
    // Only admin can access audit logs
    if (req.user.role !== 'admin') {
      return sendError(res, 403, 'Forbidden: Only admins can access audit logs');
    }

    const queryParams = req.query || {};
    const page = Math.max(1, parseInt(queryParams.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(queryParams.limit) || 50));
    const offset = (page - 1) * limit;
    const userId = queryParams.user_id;
    const action = queryParams.action;

    let sql = `
      SELECT a.*, u.email as user_email, u.name as user_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      sql += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (action) {
      sql += ' AND a.action = ?';
      params.push(action);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const logs = await query(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = [];
    if (userId) {
      countSql += ' AND user_id = ?';
      countParams.push(userId);
    }
    if (action) {
      countSql += ' AND action = ?';
      countParams.push(action);
    }
    const [countResult] = await query(countSql, countParams);
    const total = countResult.total;

    sendJSON(res, 200, {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    sendError(res, 500, 'Failed to fetch audit logs');
  }
};

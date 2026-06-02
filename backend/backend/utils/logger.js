import { query } from '../config/database.js';
import { getIO } from './socket.js';

export const logAudit = async (userId, action, entityType, entityId = null, details = null, req = null) => {
  try {
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || null;
    const userAgent = req?.headers['user-agent'] || null;

    const result = await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
    );

    // Emit real-time notification
    const io = getIO();
    io.emit('new_audit', {
      id: result.insertId,
      userId,
      action,
      entityType,
      details,
      created_at: new Date()
    });
  } catch (error) {
    console.error('Audit logging error:', error);
  }
};

export const logError = (message, error, req = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    message,
    error: error?.message || error,
    stack: error?.stack,
    url: req?.url,
    method: req?.method
  };
  console.error(JSON.stringify(logEntry));
};

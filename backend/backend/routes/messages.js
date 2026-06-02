import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';
import Busboy from 'busboy';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'messages');

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/** List conversations: inbox + sent, grouped by other user */
export const handleGetMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const tab = req.query?.tab || 'inbox'; // inbox | sent

    let sql, params;
    if (tab === 'sent') {
      sql = `
        SELECT m.*, 
          r.id as other_id, r.name as other_name, r.email as other_email, r.role as other_role,
          s.name as sender_name
        FROM messages m
        JOIN users r ON r.id = m.recipient_id
        JOIN users s ON s.id = m.sender_id
        WHERE m.sender_id = ? AND m.parent_id IS NULL
        ORDER BY m.created_at DESC
      `;
      params = [userId];
    } else {
      sql = `
        SELECT m.*, 
          s.id as other_id, s.name as other_name, s.email as other_email, s.role as other_role,
          s.name as sender_name
        FROM messages m
        JOIN users s ON s.id = m.sender_id
        WHERE m.recipient_id = ? AND m.parent_id IS NULL
        ORDER BY m.created_at DESC
      `;
      params = [userId];
    }

    const rows = await query(sql, params);
    sendJSON(res, 200, { messages: rows || [], tab });
  } catch (error) {
    console.error('Get messages error:', error);
    sendError(res, 500, 'Failed to fetch messages');
  }
};

/** Get thread: message + all replies with attachments */
export const handleGetMessageThread = async (req, res) => {
  try {
    const mid = parseInt(req.params.id);
    if (isNaN(mid)) return sendError(res, 400, 'Invalid message ID');

    const userId = req.user.id;
    const [msg] = await query(
      `SELECT m.*, s.name as sender_name, s.email as sender_email, r.name as recipient_name, r.email as recipient_email
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.recipient_id
       WHERE m.id = ? AND (m.sender_id = ? OR m.recipient_id = ?)`,
      [mid, userId, userId]
    );
    if (!msg) return sendError(res, 404, 'Message not found');

    const rootId = msg.parent_id || msg.id;
    const thread = await query(
      `SELECT m.*, s.name as sender_name, s.email as sender_email
       FROM messages m
       JOIN users s ON s.id = m.sender_id
       WHERE (m.id = ? OR m.parent_id = ?)
       ORDER BY m.created_at ASC`,
      [rootId, rootId]
    );

    const attMap = {};
    for (const m of thread || []) {
      const atts = await query(
        'SELECT id, file_name, file_path, file_size, mime_type FROM message_attachments WHERE message_id = ?',
        [m.id]
      );
      attMap[m.id] = atts || [];
    }

    const threadWithAtts = (thread || []).map((m) => ({
      ...m,
      attachments: attMap[m.id] || []
    }));

    sendJSON(res, 200, { message: msg, thread: threadWithAtts });
  } catch (error) {
    console.error('Get message thread error:', error);
    sendError(res, 500, 'Failed to fetch message');
  }
};

/** Mark message as read */
export const handleMarkMessageRead = async (req, res) => {
  try {
    const mid = parseInt(req.params.id);
    if (isNaN(mid)) return sendError(res, 400, 'Invalid message ID');
    const userId = req.user.id;
    await query(
      'UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ?',
      [mid, userId]
    );
    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    sendError(res, 500, 'Failed to mark as read');
  }
};

function parseMultipartMessage(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const ct = req.headers['content-type'] || '';
    if (!ct.includes('multipart/form-data')) {
      resolve({ fields: {}, files: [] });
      return;
    }
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 20 * 1024 * 1024 } });
    busboy.on('field', (name, value) => {
      if (name === 'recipient_id' || name === 'parent_id') {
        fields[name] = parseInt(value, 10);
      } else {
        fields[name] = value;
      }
    });
    busboy.on('file', (name, file, info) => {
      const filename = (typeof info === 'object' ? info.filename : info) || 'file';
      const chunks = [];
      file.on('data', (c) => chunks.push(c));
      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        files.push({ field: name, filename, buffer, mimeType: info.mimeType || 'application/octet-stream' });
      });
      file.resume();
    });
    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, files }));
    req.pipe(busboy);
  });
}

/** Send new message or reply. Accepts JSON or multipart with optional attachments. */
export const handleSendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    let recipientId, subject, body, parentId;

    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('multipart/form-data')) {
      const { fields, files } = await parseMultipartMessage(req);
      recipientId = parseInt(fields.recipient_id, 10) || null;
      subject = fields.subject || '';
      body = fields.body || '';
      parentId = fields.parent_id ? parseInt(fields.parent_id, 10) : null;

      if (!recipientId || !body?.trim()) return sendError(res, 400, 'recipient_id and body are required');
      const [recipCheck] = await query('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [recipientId]);
      if (!recipCheck) return sendError(res, 404, 'Recipient not found');

      ensureUploadDir();
      const result = await query(
        `INSERT INTO messages (sender_id, recipient_id, parent_id, subject, body) VALUES (?, ?, ?, ?, ?)`,
        [userId, recipientId, parentId, subject, body]
      );
      const messageId = result?.insertId;
      if (!messageId) {
        return sendError(res, 500, 'Failed to create message');
      }

      for (const f of files) {
        const ext = path.extname(f.filename) || '';
        const safeName = `msg_${messageId}_${Date.now()}_${String(f.filename).replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80)}`;
        const relPath = path.join('messages', safeName);
        const fullPath = path.join(UPLOAD_DIR, safeName);
        fs.writeFileSync(fullPath, f.buffer);
        await query(
          `INSERT INTO message_attachments (message_id, file_name, file_path, file_size, mime_type) VALUES (?, ?, ?, ?, ?)`,
          [messageId, f.filename, relPath, f.buffer.length, f.mimeType]
        );
      }

      await logAudit(userId, 'SEND_MESSAGE', 'message', messageId, { recipientId, hasAttachments: files.length > 0 }, req);
      sendJSON(res, 201, { success: true, id: messageId });
      return;
    }

    const body_ = await parseBody(req);
    recipientId = body_.recipient_id;
    subject = body_.subject || '';
    body = body_.body || '';
    parentId = body_.parent_id ? parseInt(body_.parent_id, 10) : null;

    if (!recipientId) return sendError(res, 400, 'recipient_id is required');
    if (!body || !String(body).trim()) return sendError(res, 400, 'body is required');

    const [userRow] = await query('SELECT id FROM users WHERE id = ? AND is_active = TRUE', [recipientId]);
    if (!userRow) return sendError(res, 404, 'Recipient not found');

    const result = await query(
      `INSERT INTO messages (sender_id, recipient_id, parent_id, subject, body) VALUES (?, ?, ?, ?, ?)`,
      [userId, recipientId, parentId, subject, body]
    );
    const messageId = result?.insertId;
    await logAudit(userId, 'SEND_MESSAGE', 'message', messageId, { recipientId }, req);
    sendJSON(res, 201, { success: true, id: messageId });
  } catch (error) {
    console.error('Send message error:', error);
    sendError(res, 500, 'Failed to send message');
  }
};

/** Download attachment */
export const handleGetAttachment = async (req, res) => {
  try {
    const attId = parseInt(req.params.id);
    if (isNaN(attId)) return sendError(res, 400, 'Invalid attachment ID');
    const [att] = await query('SELECT * FROM message_attachments WHERE id = ?', [attId]);
    if (!att) return sendError(res, 404, 'Attachment not found');

    const [msg] = await query('SELECT id, sender_id, recipient_id FROM messages WHERE id = ?', [att.message_id]);
    const userId = req.user.id;
    if (!msg || (msg.sender_id !== userId && msg.recipient_id !== userId)) {
      return sendError(res, 403, 'Access denied');
    }

    const fullPath = path.join(process.cwd(), 'uploads', att.file_path);
    if (!fs.existsSync(fullPath)) return sendError(res, 404, 'File not found');
    const buf = fs.readFileSync(fullPath);
    res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.file_name)}"`);
    res.writeHead(200);
    res.end(buf);
  } catch (error) {
    console.error('Get attachment error:', error);
    sendError(res, 500, 'Failed to download attachment');
  }
};

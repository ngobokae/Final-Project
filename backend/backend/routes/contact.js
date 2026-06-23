import { query } from '../config/database.js';
import { parseBody, sendJSON, sendError } from '../utils/helpers.js';
import { logAudit } from '../utils/logger.js';

const SYSTEM_CONTACT_EMAIL = 'website-contact@kinglion.system';

const ensureContactTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS contact_inquiries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      body TEXT NOT NULL,
      message_id INT DEFAULT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_read (is_read),
      INDEX idx_created (created_at)
    )
  `);
};

const getAdminRecipientId = async () => {
  const [admin] = await query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE ORDER BY id ASC LIMIT 1`
  );
  return admin?.id || null;
};

const ensureWebsiteContactUser = async () => {
  const [existing] = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [SYSTEM_CONTACT_EMAIL]);
  if (existing?.id) return existing.id;

  const result = await query(
    `INSERT INTO users (email, password_hash, name, role, is_active, email_verified)
     VALUES (?, ?, ?, 'operations', FALSE, TRUE)`,
    [SYSTEM_CONTACT_EMAIL, 'NOT_A_LOGIN_ACCOUNT', 'Website Contact']
  );
  return result?.insertId;
};

export const handleSubmitContact = async (req, res) => {
  try {
    await ensureContactTable();

    const payload = await parseBody(req);
    const name = String(payload.name || '').trim();
    const email = String(payload.email || '').trim();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || payload.message || '').trim();

    if (!name || !email || !subject || !body) {
      return sendError(res, 400, 'Name, email, subject, and message are required');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return sendError(res, 400, 'Please enter a valid email address');
    }

    const adminId = await getAdminRecipientId();
    if (!adminId) {
      return sendError(res, 503, 'No admin account is available to receive messages right now');
    }

    const senderId = await ensureWebsiteContactUser();
    const formattedBody = `Website contact form submission\n\nName: ${name}\nEmail: ${email}\n\n${body}`;
    const messageSubject = `[Contact Us] ${subject}`;

    const messageResult = await query(
      `INSERT INTO messages (sender_id, recipient_id, parent_id, subject, body) VALUES (?, ?, NULL, ?, ?)`,
      [senderId, adminId, messageSubject, formattedBody]
    );
    const messageId = messageResult?.insertId;

    await query(
      `INSERT INTO contact_inquiries (name, email, subject, body, message_id) VALUES (?, ?, ?, ?, ?)`,
      [name, email, subject, body, messageId || null]
    );

    sendJSON(res, 201, { success: true, message: 'Your message has been sent to our team.' });
  } catch (error) {
    console.error('Submit contact error:', error);
    sendError(res, 500, 'Failed to send your message. Please try again.');
  }
};

export const handleGetContactInquiries = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, 403, 'Forbidden');
    }

    await ensureContactTable();
    const inquiries = await query(
      `SELECT id, name, email, subject, body, message_id, is_read, created_at
       FROM contact_inquiries
       ORDER BY created_at DESC`
    );

    sendJSON(res, 200, { inquiries: inquiries || [] });
  } catch (error) {
    console.error('Get contact inquiries error:', error);
    sendError(res, 500, 'Failed to fetch website contact messages');
  }
};

export const handleGetContactUnreadCount = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, 403, 'Forbidden');
    }

    await ensureContactTable();
    const [row] = await query(
      `SELECT COUNT(*) as unread FROM contact_inquiries WHERE is_read = 0`
    );

    sendJSON(res, 200, { unread: Number(row?.unread || 0) });
  } catch (error) {
    console.error('Get contact unread count error:', error);
    sendError(res, 500, 'Failed to fetch unread contact count');
  }
};

export const handleMarkContactInquiryRead = async (req, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return sendError(res, 403, 'Forbidden');
    }

    const id = parseInt(req.params?.id, 10);
    if (!id) return sendError(res, 400, 'Invalid inquiry id');

    await ensureContactTable();
    const [inquiry] = await query('SELECT message_id FROM contact_inquiries WHERE id = ?', [id]);
    if (!inquiry) return sendError(res, 404, 'Inquiry not found');

    await query('UPDATE contact_inquiries SET is_read = 1 WHERE id = ?', [id]);

    if (inquiry.message_id) {
      await query(
        'UPDATE messages SET is_read = TRUE WHERE id = ? AND recipient_id = ?',
        [inquiry.message_id, req.user.id]
      );
    }

    await logAudit(req.user.id, 'READ_CONTACT_INQUIRY', 'contact_inquiry', id, {}, req);
    sendJSON(res, 200, { success: true });
  } catch (error) {
    console.error('Mark contact inquiry read error:', error);
    sendError(res, 500, 'Failed to update inquiry');
  }
};

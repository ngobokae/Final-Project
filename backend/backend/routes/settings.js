import { query } from '../config/database.js';
import { sendSuccess, sendError, parseBody } from '../utils/helpers.js';
import { buildAlertEmailHtml, sendEmail } from '../utils/email.js';
import { getManySettings, getSetting } from '../utils/systemSettings.js';

const parseSettingValue = (row) => {
  let value = row.setting_value;
  if (row.setting_type === 'boolean') {
    value = value === 'true';
  } else if (row.setting_type === 'number') {
    value = parseFloat(value);
  } else if (row.setting_type === 'json') {
    try {
      value = JSON.parse(value);
    } catch (e) {}
  }
  return value;
};

const inferType = (value) => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number' && Number.isFinite(value)) return 'number';
  if (value && typeof value === 'object') return 'json';
  return 'string';
};

export const handleGetSettings = async (req, res) => {
  try {
    const settings = await query(`
      SELECT * FROM system_settings
      ORDER BY category, setting_key
    `);
    
    // Convert to object format for easier frontend use
    const settingsObj = {};
    const flat = {};
    settings.forEach(s => {
      const value = parseSettingValue(s);
      settingsObj[s.setting_key] = {
        value,
        type: s.setting_type,
        category: s.category,
        description: s.description
      };
      flat[s.setting_key] = value;
    });
    
    // Backward compatible: keep structured settings + add a flat map
    sendSuccess(res, { settings: settingsObj, flat, raw: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    sendError(res, 500, 'Failed to fetch settings');
  }
};

export const handleGetSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const settings = await query('SELECT * FROM system_settings WHERE setting_key = ?', [key]);
    
    if (settings.length === 0) {
      return sendError(res, 404, 'Setting not found');
    }
    sendSuccess(res, settings[0]);
  } catch (error) {
    console.error('Get setting error:', error);
    sendError(res, 500, 'Failed to fetch setting');
  }
};

export const handleUpdateSetting = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { key, value } = body;
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    await query(`
      UPDATE system_settings 
      SET setting_value = ?, updated_by = ?
      WHERE setting_key = ?
    `, [stringValue, req.user?.id, key]);
    
    sendSuccess(res, { message: 'Setting updated' });
  } catch (error) {
    console.error('Update setting error:', error);
    sendError(res, 500, 'Failed to update setting');
  }
};

export const handleUpdateSettings = async (req, res) => {
  try {
    const body = await parseBody(req);
    // Accept either { settings: {...} } or a flat object of key/value pairs
    const settings = body.settings && typeof body.settings === 'object' ? body.settings : body;

    const prevSiteName = await getSetting('site_name', null);
    
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const type = inferType(value);
      // Upsert so keys do not need to exist beforehand
      await query(
        `
        INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, updated_by)
        VALUES (?, ?, ?, 'custom', NULL, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), setting_type = VALUES(setting_type), updated_by = VALUES(updated_by)
        `,
        [key, stringValue, type, req.user?.id]
      );
    }

    // If site name changed, return it so frontend can update title immediately
    const nextSiteName = settings.site_name != null ? settings.site_name : prevSiteName;
    
    sendSuccess(res, { message: 'Settings updated', site_name: nextSiteName });
  } catch (error) {
    console.error('Update settings error:', error);
    sendError(res, 500, 'Failed to update settings');
  }
};

export const handleSendTestAlertEmail = async (req, res) => {
  try {
    const body = await parseBody(req);
    const toRaw = body?.to;

    const { site_name, alert_email_recipients } = await getManySettings([
      'site_name',
      'alert_email_recipients'
    ]);

    const to =
      (toRaw && String(toRaw).trim()) ||
      (alert_email_recipients && String(alert_email_recipients).trim()) ||
      '';

    if (!to) {
      return sendError(res, 400, 'Please set alert_email_recipients (or pass {to}) first.');
    }

    const html = buildAlertEmailHtml({
      siteName: site_name || 'Kinglion',
      alerts: [
        {
          severity: 'high',
          alert_type: 'test_alert',
          product_name: 'Sample Product',
          sku: 'TEST-001',
          message: 'This is a test alert email from System Settings.'
        }
      ]
    });

    await sendEmail({
      to,
      subject: `${site_name || 'Kinglion'} · Test Alert Email`,
      html,
      text: 'This is a test alert email.'
    });

    sendSuccess(res, { success: true, message: 'Test email sent.' });
  } catch (error) {
    console.error('Send test email error:', error);
    sendError(res, 500, error?.message || 'Failed to send test email');
  }
};

export const handleCreateSetting = async (req, res) => {
  try {
    const body = await parseBody(req);
    const { key, value, type, category, description } = body;
    
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    
    const result = await query(`
      INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = ?, updated_by = ?
    `, [key, stringValue, type || 'string', category || 'general', description, req.user?.id, stringValue, req.user?.id]);
    
    sendSuccess(res, { message: 'Setting created/updated' }, 201);
  } catch (error) {
    console.error('Create setting error:', error);
    sendError(res, 500, 'Failed to create setting');
  }
};

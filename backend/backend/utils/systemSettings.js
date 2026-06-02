import { query } from '../config/database.js';

const parseSettingValue = (row) => {
  let value = row?.setting_value;
  const type = row?.setting_type;
  if (type === 'boolean') {
    value = value === 'true';
  } else if (type === 'number') {
    value = parseFloat(value);
  } else if (type === 'json') {
    try {
      value = JSON.parse(value);
    } catch {
      // ignore
    }
  }
  return value;
};

export async function getSetting(key, fallback = null) {
  try {
    const rows = await query(
      'SELECT setting_value, setting_type FROM system_settings WHERE setting_key = ? LIMIT 1',
      [key]
    );
    if (!rows?.length) return fallback;
    const v = parseSettingValue(rows[0]);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getManySettings(keys) {
  const out = {};
  await Promise.all(
    (keys || []).map(async (k) => {
      out[k] = await getSetting(k, null);
    })
  );
  return out;
}

export async function setSetting(key, value, updatedBy = null) {
  const settingType =
    typeof value === 'boolean' ? 'boolean' :
    typeof value === 'number' && Number.isFinite(value) ? 'number' :
    value && typeof value === 'object' ? 'json' : 'string';

  const settingValue =
    settingType === 'json' ? JSON.stringify(value) :
    settingType === 'boolean' ? (value ? 'true' : 'false') :
    String(value);

  await query(
    `
      INSERT INTO system_settings (setting_key, setting_value, setting_type, category, description, updated_by)
      VALUES (?, ?, ?, 'user', 'User preference', ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        setting_type = VALUES(setting_type),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [key, settingValue, settingType, updatedBy]
  );
}


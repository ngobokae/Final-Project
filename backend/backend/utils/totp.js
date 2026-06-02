import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { query } from '../config/database.js';

export const ensureTotpColumns = async () => {
  // Add columns if they don't exist. (MySQL allows IF NOT EXISTS only for tables, so we inspect first.)
  const cols = await query('SHOW COLUMNS FROM users').catch(() => []);
  const has = (name) =>
    (cols || []).some((c) => String(c.Field || '').toLowerCase() === String(name).toLowerCase());

  const alters = [];
  if (!has('totp_secret_base32')) alters.push("ADD COLUMN totp_secret_base32 VARCHAR(128) NULL");
  if (!has('totp_pending_secret_base32')) alters.push("ADD COLUMN totp_pending_secret_base32 VARCHAR(128) NULL");
  if (!has('totp_enabled')) alters.push("ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0");
  if (!has('totp_enabled_at')) alters.push("ADD COLUMN totp_enabled_at DATETIME NULL");

  if (alters.length) {
    await query(`ALTER TABLE users ${alters.join(', ')}`);
  }
};

export const generateTotpSecret = ({ label, issuer }) => {
  return speakeasy.generateSecret({
    name: label,
    issuer,
    length: 20
  });
};

export const verifyTotp = ({ secretBase32, token, window = 1 }) => {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: String(token || '').replace(/\s+/g, ''),
    window
  });
};

export const toQrDataUrl = async (otpauthUrl) => {
  // data:image/png;base64,...
  return qrcode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6
  });
};


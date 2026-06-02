import nodemailer from 'nodemailer';

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export function buildAlertEmailHtml({ siteName, alerts }) {
  const safeName = escapeHtml(siteName || 'Kinglion');
  const items = alerts || [];
  const counts = items.reduce(
    (acc, a) => {
      const s = String(a?.severity || 'medium').toLowerCase();
      acc.total += 1;
      if (s === 'critical') acc.critical += 1;
      else if (s === 'high') acc.high += 1;
      else if (s === 'medium') acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { total: 0, critical: 0, high: 0, medium: 0, low: 0 }
  );

  const severityColor = (sev) => {
    const s = String(sev || '').toLowerCase();
    if (s === 'critical') return '#b91c1c';
    if (s === 'high') return '#dc2626';
    if (s === 'medium') return '#d97706';
    return '#2563eb';
  };

  const list = (alerts || [])
    .map((a) => {
      const sev = escapeHtml(a.severity || 'medium');
      const typ = escapeHtml(a.alert_type || 'alert');
      const prod = escapeHtml(a.product_name || a.sku || '');
      const msg = escapeHtml(a.message || '');
      const color = severityColor(sev);
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #eee;font-family:Arial,sans-serif;font-size:13px;color:#111;">
            <div style="font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.4px;color:${color};">${sev}</div>
            <div style="font-weight:700;margin-top:4px;">${typ}${prod ? ` · ${prod}` : ''}</div>
            <div style="margin-top:6px;color:#444;line-height:1.35;">${msg}</div>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
  <div style="background:#f6f6f6;padding:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
      <tr>
        <td style="background:linear-gradient(90deg,#0a0a0a,#7f1d1d);padding:18px 20px;">
          <div style="font-family:Arial,sans-serif;color:#fff;font-size:18px;font-weight:800;">${safeName}</div>
          <div style="font-family:Arial,sans-serif;color:rgba(255,255,255,.85);font-size:12px;margin-top:4px;">
            System Alert Notification
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px;font-family:Arial,sans-serif;color:#111;">
          <div style="font-size:14px;color:#333;line-height:1.5;">
            The system detected ${counts.total} alert(s) that require attention.
          </div>
          <div style="margin-top:12px;padding:10px 12px;border:1px solid #eee;border-radius:10px;background:#fafafa;font-family:Arial,sans-serif;">
            <div style="font-size:12px;color:#111;font-weight:700;margin-bottom:6px;">Severity summary</div>
            <div style="font-size:12px;color:#333;line-height:1.6;">
              <span style="color:#b91c1c;font-weight:700;">Critical: ${counts.critical}</span> ·
              <span style="color:#dc2626;font-weight:700;">High: ${counts.high}</span> ·
              <span style="color:#d97706;font-weight:700;">Medium: ${counts.medium}</span> ·
              <span style="color:#2563eb;font-weight:700;">Low: ${counts.low}</span>
            </div>
          </div>
          <div style="margin-top:12px;border:1px solid #eee;border-radius:10px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${list || `
                <tr>
                  <td style="padding:12px;font-family:Arial,sans-serif;font-size:13px;color:#444;">
                    No alerts in this message.
                  </td>
                </tr>
              `}
            </table>
          </div>
          <div style="margin-top:14px;font-size:12px;color:#666;">
            Tip: Open the dashboard to review details and take action.
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;background:#fafafa;border-top:1px solid #eee;font-family:Arial,sans-serif;font-size:11px;color:#777;">
          Sent by ${safeName}. This is an automated email.
        </td>
      </tr>
    </table>
  </div>
  `;
}

export async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email is not configured (missing SMTP_* env vars).');
  }

  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'no-reply@localhost';

  return transporter.sendMail({
    from,
    to,
    subject,
    text: text || '',
    html: html || ''
  });
}

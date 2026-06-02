import { verifyToken, extractTokenFromHeader } from '../config/auth.js';
import { query } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No token provided' }));
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or expired token' }));
      return;
    }

    // Get user from database (include theme for dark/light preference)
    const users = await query('SELECT id, email, name, role, is_active, COALESCE(theme, \'light\') as theme FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0 || !users[0].is_active) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'User not found or inactive' }));
      return;
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication failed' }));
  }
};

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden: Insufficient permissions' }));
      return;
    }

    next();
  };
};

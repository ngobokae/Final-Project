import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const JWT_2FA_EXPIRES_IN = process.env.JWT_2FA_EXPIRES_IN || '5m';

export const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const generate2FAToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    purpose: '2fa'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_2FA_EXPIRES_IN });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
};

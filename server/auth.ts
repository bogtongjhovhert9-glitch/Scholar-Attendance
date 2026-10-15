import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  findAdminByUsername,
  findAdminById,
  checkLoginLockout,
  recordFailedLogin,
  resetLoginAttempts,
} from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'osc_duty_scholars_jwt_secret_key_2026_manila';

export interface AuthenticatedRequest extends Request {
  adminUser?: {
    id: string;
    username: string;
    role: string;
  };
}

export function generateToken(admin: { id: string; username: string; role: string }): string {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role: string };
    const admin = findAdminById(decoded.id);
    if (!admin) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }
    req.adminUser = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

export async function handleLogin(req: Request, res: Response) {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const lockoutKey = `${username.toLowerCase()}_${clientIp}`;

  // Check lockout
  const lockoutStatus = checkLoginLockout(lockoutKey);
  if (lockoutStatus.locked) {
    res.status(429).json({
      error: `Account locked due to 5 consecutive failed attempts. Please try again in ${lockoutStatus.waitMinutes} minute(s).`,
      locked: true,
      waitMinutes: lockoutStatus.waitMinutes,
    });
    return;
  }

  const admin = findAdminByUsername(username);
  if (!admin) {
    const failInfo = recordFailedLogin(lockoutKey);
    if (failInfo.locked) {
      res.status(429).json({
        error: `Too many failed attempts. Account locked for 15 minutes.`,
        locked: true,
        waitMinutes: 15,
      });
      return;
    }
    res.status(401).json({
      error: `Invalid credentials. ${failInfo.remainingAttempts} attempt(s) remaining.`,
      remainingAttempts: failInfo.remainingAttempts,
    });
    return;
  }

  const isMatch = bcrypt.compareSync(password, admin.password_hash);
  if (!isMatch) {
    const failInfo = recordFailedLogin(lockoutKey);
    if (failInfo.locked) {
      res.status(429).json({
        error: `Too many failed attempts. Account locked for 15 minutes.`,
        locked: true,
        waitMinutes: 15,
      });
      return;
    }
    res.status(401).json({
      error: `Invalid credentials. ${failInfo.remainingAttempts} attempt(s) remaining.`,
      remainingAttempts: failInfo.remainingAttempts,
    });
    return;
  }

  // Success: reset attempts
  resetLoginAttempts(lockoutKey);

  const token = generateToken(admin);

  res.json({
    token,
    user: {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      must_change_password: admin.must_change_password,
    },
  });
}

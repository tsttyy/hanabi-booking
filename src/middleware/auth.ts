import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { sendError } from '../utils/api.js';

export type AuthUser = {
  id: string;
  businessId: string | null;
  email: string;
  role: 'SYSTEM_OWNER' | 'BUSINESS_ADMIN';
  status: 'ACTIVE' | 'DISABLED';
};

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '8h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.token;
  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    sendError(res, 401, 'AUTH_ERROR', 'Invalid or expired token');
  }
}

export function requireRole(...roles: Array<AuthUser['role']>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    if (!roles.includes(user.role)) {
      sendError(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource');
      return;
    }

    next();
  };
}

export function requireBusinessAccess(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
    return;
  }

  if (user.role === 'SYSTEM_OWNER') {
    next();
    return;
  }

  if (!user.businessId) {
    sendError(res, 403, 'FORBIDDEN', 'Business access required');
    return;
  }

  req.businessId = user.businessId;
  next();
}

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

export type AuthCustomer = {
  id: string;
  email: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
};

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.jwtSecret, { expiresIn: '8h' });
}

export function signCustomerToken(customer: AuthCustomer) {
  return jwt.sign(customer, env.jwtSecret, { expiresIn: '8h' });
}

import { prisma } from '../lib/prisma.js';

type AuthStatusCacheEntry = { cachedAt: number; userActive: boolean; businessActive: boolean };
const AUTH_STATUS_CACHE_TTL_MS = 10_000;
const authStatusCache = new Map<string, AuthStatusCacheEntry>();
if (typeof setInterval === 'function') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of authStatusCache) {
      if (now - v.cachedAt > AUTH_STATUS_CACHE_TTL_MS) authStatusCache.delete(k);
    }
  }, 30_000).unref?.();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
    if (payload.role !== 'SYSTEM_OWNER' && payload.role !== 'BUSINESS_ADMIN') {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }
    
    const cacheKey = payload.id;
    const now = Date.now();
    const cacheHit = authStatusCache.get(cacheKey);
    const cacheFresh = cacheHit && now - cacheHit.cachedAt < AUTH_STATUS_CACHE_TTL_MS;

    let userActive: boolean;
    let businessActive: boolean;

    if (cacheFresh) {
      userActive = cacheHit!.userActive;
      businessActive = cacheHit!.businessActive;
    } else {
      const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { status: true, businessId: true } });
      userActive = !!(user && user.status === 'ACTIVE');
      businessActive = true;
      if (userActive && user?.businessId) {
        const business = await prisma.business.findUnique({ where: { id: user.businessId }, select: { status: true } });
        businessActive = !!(business && business.status === 'ACTIVE');
      }
      authStatusCache.set(cacheKey, { cachedAt: Date.now(), userActive, businessActive });
    }

    if (!userActive) {
      sendError(res, 401, 'AUTH_ERROR', 'User account is disabled or missing');
      return;
    }
    if (!businessActive) {
      sendError(res, 401, 'AUTH_ERROR', 'Business is disabled or missing');
      return;
    }

    req.user = payload;
    next();
  } catch (err) {
    sendError(res, 401, 'AUTH_ERROR', 'Invalid or expired token');
  }
}

export async function requireCustomerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenFromCookie = req.cookies?.customerToken;
  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthCustomer & { role?: string };
    if (payload.role === 'SYSTEM_OWNER' || payload.role === 'BUSINESS_ADMIN') {
      sendError(res, 403, 'FORBIDDEN', 'You do not have permission to access this resource');
      return;
    }

    // DB status freshness check
    const customer = await prisma.customer.findUnique({ where: { id: payload.id } });
    if (!customer || customer.status !== 'ACTIVE') {
      sendError(res, 401, 'AUTH_ERROR', 'Customer account is disabled or missing');
      return;
    }

    req.customer = payload;
    next();
  } catch (err) {
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

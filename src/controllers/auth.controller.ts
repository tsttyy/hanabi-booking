import { NextFunction, Request, Response } from 'express';
import { loginSchema } from '../validation/schemas.js';
import { authenticateUser } from '../services/auth.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid request');
      return;
    }

    const result = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!result) {
      sendError(res, 401, 'AUTH_ERROR', 'Invalid email or password');
      return;
    }

    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, 200, { user: result.user, token: result.token });
  } catch (error) {
    next(error);
  }
}

export function logoutController(_req: Request, res: Response) {
  res.clearCookie('token');
  sendSuccess(res, 200, { message: 'Logged out successfully' });
}

export function meController(req: Request, res: Response) {
  if (!req.user) {
    sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
    return;
  }

  sendSuccess(res, 200, { user: req.user });
}

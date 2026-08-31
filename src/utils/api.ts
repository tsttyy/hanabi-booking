import { Response } from 'express';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

export function sendError(response: Response, status: number, code: ApiErrorCode, message: string) {
  response.status(status).json({ success: false, error: { code, message } });
}

export function sendSuccess<T>(response: Response, status: number, payload: T) {
  response.status(status).json({ success: true, ...payload });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

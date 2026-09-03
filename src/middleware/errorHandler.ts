import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/api.js';

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(error);
  const status = (error as { status?: number }).status ?? 500;
  const message = error.message; // Temporarily exposed
  sendError(res, status, status === 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', message);
}

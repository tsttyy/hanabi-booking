import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/api.js';

export function errorHandler(error: Error, _req: Request, res: Response, _next: NextFunction) {
  const status = (error as { status?: number }).status ?? 500;
  const message = status === 500 ? 'Unexpected server error' : error.message;
  sendError(res, status, status === 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR', message);
}

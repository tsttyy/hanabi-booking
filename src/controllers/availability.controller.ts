import { NextFunction, Request, Response } from 'express';
import { availabilitySchema } from '../validation/schemas.js';
import * as availabilityService from '../services/availability.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listAvailabilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const availability = await availabilityService.listAvailabilityForBusiness(businessId);
    sendSuccess(res, 200, { availability });
  } catch (error) {
    next(error);
  }
}

export async function createAvailabilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = availabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid availability payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const availability = await availabilityService.createAvailabilityForBusiness(businessId, { ...parsed.data, status: parsed.data.status ?? 'ACTIVE' });
    sendSuccess(res, 201, { availability });
  } catch (error) {
    next(error);
  }
}

export async function updateAvailabilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = availabilitySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid availability update payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const availability = await availabilityService.updateAvailabilityForBusiness(businessId, id, parsed.data);
    sendSuccess(res, 200, { availability });
  } catch (error) {
    next(error);
  }
}

export async function deleteAvailabilityController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const availability = await availabilityService.deleteAvailabilityForBusiness(businessId, id);
    if (!availability) {
      sendError(res, 404, 'NOT_FOUND', 'Availability not found');
      return;
    }
    sendSuccess(res, 200, { availability });
  } catch (error) {
    next(error);
  }
}

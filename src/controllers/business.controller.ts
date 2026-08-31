import { NextFunction, Request, Response } from 'express';
import { businessCreateSchema, businessStatusSchema } from '../validation/schemas.js';
import * as businessService from '../services/business.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listBusinessesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const businesses = await businessService.listBusinesses();
    sendSuccess(res, 200, { businesses });
  } catch (error) {
    next(error);
  }
}

export async function createBusinessController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = businessCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid business payload');
      return;
    }

    const business = await businessService.createBusiness({
      ...parsed.data,
      status: parsed.data.status ?? 'ACTIVE',
    });
    sendSuccess(res, 201, { business });
  } catch (error) {
    next(error);
  }
}

export async function getBusinessController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const business = await businessService.getBusinessById(id);
    if (!business) {
      sendError(res, 404, 'NOT_FOUND', 'Business not found');
      return;
    }
    sendSuccess(res, 200, { business });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = businessStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid business status');
      return;
    }

    const id = String(req.params.id);
    const business = await businessService.updateBusinessStatus(id, parsed.data.status);
    sendSuccess(res, 200, { business });
  } catch (error) {
    next(error);
  }
}

export async function getBusinessProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business admin must belong to a business');
      return;
    }

    const business = await businessService.getBusinessProfile(req.user.businessId);
    if (!business) {
      sendError(res, 404, 'NOT_FOUND', 'Business profile not found');
      return;
    }

    sendSuccess(res, 200, { business });
  } catch (error) {
    next(error);
  }
}

export async function updateBusinessProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business admin must belong to a business');
      return;
    }

    const business = await businessService.updateBusinessProfile(req.user.businessId, req.body);
    sendSuccess(res, 200, { business });
  } catch (error) {
    next(error);
  }
}

import { NextFunction, Request, Response } from 'express';
import { staffSchema } from '../validation/schemas.js';
import * as staffService from '../services/staff.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const staff = await staffService.listStaffForBusiness(businessId);
    sendSuccess(res, 200, { staff });
  } catch (error) {
    next(error);
  }
}

export async function createStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = staffSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid staff payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const staff = await staffService.createStaffForBusiness(businessId, { ...parsed.data, status: parsed.data.status ?? 'ACTIVE' });
    sendSuccess(res, 201, { staff });
  } catch (error) {
    next(error);
  }
}

export async function getStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const staff = await staffService.getStaffForBusiness(businessId, id);
    if (!staff) {
      sendError(res, 404, 'NOT_FOUND', 'Staff not found');
      return;
    }
    sendSuccess(res, 200, { staff });
  } catch (error) {
    next(error);
  }
}

export async function updateStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = staffSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid staff update payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const staff = await staffService.updateStaffForBusiness(businessId, id, parsed.data);
    sendSuccess(res, 200, { staff });
  } catch (error) {
    next(error);
  }
}

export async function deleteStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const staff = await staffService.deleteStaffForBusiness(businessId, id);
    if (!staff) {
      sendError(res, 404, 'NOT_FOUND', 'Staff not found');
      return;
    }
    sendSuccess(res, 200, { staff });
  } catch (error) { next(error); }
}

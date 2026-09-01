import { NextFunction, Request, Response } from 'express';
import { serviceSchema } from '../validation/schemas.js';
import * as serviceService from '../services/service.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listServicesController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const services = await serviceService.listServicesForBusiness(businessId);
    sendSuccess(res, 200, { services });
  } catch (error) {
    next(error);
  }
}

export async function createServiceController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid service payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const service = await serviceService.createServiceForBusiness(businessId, { ...parsed.data, description: parsed.data.description ?? '' });
    sendSuccess(res, 201, { service });
  } catch (error) {
    next(error);
  }
}

export async function getServiceController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const service = await serviceService.getServiceForBusiness(businessId, id);
    if (!service) {
      sendError(res, 404, 'NOT_FOUND', 'Service not found');
      return;
    }
    sendSuccess(res, 200, { service });
  } catch (error) {
    next(error);
  }
}

export async function updateServiceController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = serviceSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid service update payload');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const service = await serviceService.updateServiceForBusiness(businessId, id, parsed.data);
    if (!service) {
      sendError(res, 404, 'NOT_FOUND', 'Service not found');
      return;
    }
    sendSuccess(res, 200, { service });
  } catch (error) {
    next(error);
  }
}

export async function deleteServiceController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const service = await serviceService.deleteServiceForBusiness(businessId, id);
    if (!service) {
      sendError(res, 404, 'NOT_FOUND', 'Service not found');
      return;
    }
    sendSuccess(res, 200, { service });
  } catch (error) {
    next(error);
  }
}

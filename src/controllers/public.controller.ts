import { NextFunction, Request, Response } from 'express';
import { buildSlotAvailability } from '../services/booking.service.js';
import * as publicService from '../services/public.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listPublicBusinessesController(_req: Request, res: Response, next: NextFunction) {
  try {
    sendSuccess(res, 200, { businesses: await publicService.listActiveBusinesses() });
  } catch (error) { next(error); }
}

export async function getPublicBusinessController(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await publicService.getActiveBusiness(String(req.params.businessId));
    if (!business) return sendError(res, 404, 'NOT_FOUND', 'Business is unavailable');
    sendSuccess(res, 200, { business });
  } catch (error) { next(error); }
}

export async function getPublicServicesController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    if (!await publicService.getActiveBusiness(businessId)) return sendError(res, 404, 'NOT_FOUND', 'Business is unavailable');
    sendSuccess(res, 200, { services: await publicService.listActiveServices(businessId) });
  } catch (error) { next(error); }
}

export async function getPublicStaffController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    if (!await publicService.getActiveBusiness(businessId)) return sendError(res, 404, 'NOT_FOUND', 'Business is unavailable');
    sendSuccess(res, 200, { staff: await publicService.listActiveStaff(businessId) });
  } catch (error) { next(error); }
}

export async function getPublicSlotsController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = String(req.params.businessId);
    const serviceId = String(req.params.serviceId);
    const date = String(req.query.date ?? '');
    const staffId = typeof req.query.staffId === 'string' ? req.query.staffId : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return sendError(res, 400, 'VALIDATION_ERROR', 'A valid date is required');
    const context = await publicService.getBookingContext(businessId, serviceId, staffId);
    if (!context) return sendError(res, 404, 'NOT_FOUND', 'Booking option is unavailable');
    const slots = await buildSlotAvailability(businessId, staffId, date, context.durationMinutes);
    sendSuccess(res, 200, { slots });
  } catch (error) { next(error); }
}

export async function lookupPublicBookingController(req: Request, res: Response, next: NextFunction) {
  try {
    const reference = String(req.query.reference ?? '').trim();
    const email = String(req.query.email ?? '').trim().toLowerCase();
    if (!reference || !/^\S+@\S+\.\S+$/.test(email)) return sendError(res, 400, 'VALIDATION_ERROR', 'Booking reference and valid email are required');
    const appointment = await publicService.getBookingForCustomer(reference, email);
    if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Booking not found');
    sendSuccess(res, 200, { appointment });
  } catch (error) { next(error); }
}

export async function cancelPublicBookingController(req: Request, res: Response, next: NextFunction) {
  try {
    const reference = String(req.body?.reference ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!reference || !/^\S+@\S+\.\S+$/.test(email)) return sendError(res, 400, 'VALIDATION_ERROR', 'Booking reference and valid email are required');
    const appointment = await publicService.cancelBookingForCustomer(reference, email);
    if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Booking not found');
    sendSuccess(res, 200, { appointment });
  } catch (error) { next(error); }
}

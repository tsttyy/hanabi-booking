import { NextFunction, Request, Response } from 'express';
import { appointmentCreateSchema, appointmentStatusSchema } from '../validation/schemas.js';
import * as appointmentService from '../services/appointment.service.js';
import { createAppointmentSafe } from '../services/booking.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function listAppointmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const appointments = await appointmentService.listAppointmentsForBusiness(businessId);
    sendSuccess(res, 200, { appointments });
  } catch (error) {
    next(error);
  }
}

export async function createAppointmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = appointmentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid appointment request');
      return;
    }

    const appointment = await createAppointmentSafe({
      businessId: parsed.data.businessId ?? req.user?.businessId ?? '',
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId ?? null,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      startAt: parsed.data.startAt,
      timezone: parsed.data.timezone,
    });

    sendSuccess(res, 201, { appointment });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status === 400 || err.status === 409) {
      sendError(res, err.status, err.status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR', err.message);
      return;
    }
    next(error);
  }
}

export async function getAppointmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const appointment = await appointmentService.getAppointmentForBusiness(businessId, id);
    if (!appointment) {
      sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
      return;
    }
    sendSuccess(res, 200, { appointment });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = appointmentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid appointment status');
      return;
    }
    const businessId = req.user?.businessId;
    if (!businessId) {
      sendError(res, 403, 'FORBIDDEN', 'Business access required');
      return;
    }
    const id = String(req.params.id);
    const appointment = await appointmentService.updateAppointmentStatusForBusiness(businessId, id, parsed.data.status);
    if (!appointment) {
      sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
      return;
    }
    sendSuccess(res, 200, { appointment });
  } catch (error) {
    next(error);
  }
}

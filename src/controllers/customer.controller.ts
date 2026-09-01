import { NextFunction, Request, Response } from 'express';
import { customerSignupSchema, customerLoginSchema, customerProfileUpdateSchema, customerPasswordChangeSchema } from '../validation/schemas.js';
import * as customerService from '../services/customer.service.js';
import * as customerAppointmentService from '../services/customer-appointment.service.js';
import { sendError, sendSuccess } from '../utils/api.js';

export async function signupController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = customerSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid signup request');
      return;
    }

    const result = await customerService.signupCustomer(
      parsed.data.name,
      parsed.data.email,
      parsed.data.password,
      parsed.data.phone
    );

    res.cookie('customerToken', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, 201, { customer: result.customer, token: result.token });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status === 409) {
      sendError(res, 409, 'CONFLICT', err.message);
      return;
    }
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = customerLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid login request');
      return;
    }

    const result = await customerService.authenticateCustomer(parsed.data.email, parsed.data.password);
    if (!result) {
      sendError(res, 401, 'AUTH_ERROR', 'Invalid email or password');
      return;
    }

    res.cookie('customerToken', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    });

    sendSuccess(res, 200, { customer: result.customer, token: result.token });
  } catch (error) {
    next(error);
  }
}

export function logoutController(_req: Request, res: Response) {
  res.clearCookie('customerToken');
  sendSuccess(res, 200, { message: 'Logged out successfully' });
}

export function meController(req: Request, res: Response) {
  if (!req.customer) {
    sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
    return;
  }

  sendSuccess(res, 200, { customer: req.customer });
}

export async function getProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const customer = await customerService.getCustomerProfile(req.customer.id);
    if (!customer) {
      sendError(res, 404, 'NOT_FOUND', 'Customer not found');
      return;
    }

    sendSuccess(res, 200, { customer });
  } catch (error) {
    next(error);
  }
}

export async function updateProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const parsed = customerProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid update request');
      return;
    }

    const customer = await customerService.updateCustomerProfile(
      req.customer.id,
      parsed.data.name,
      parsed.data.phone
    );

    sendSuccess(res, 200, { customer });
  } catch (error) {
    next(error);
  }
}

export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const parsed = customerPasswordChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid password change request');
      return;
    }

    await customerService.changeCustomerPassword(
      req.customer.id,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );

    sendSuccess(res, 200, { message: 'Password changed successfully' });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status === 400 || err.status === 404) {
      sendError(res, err.status, err.status === 404 ? 'NOT_FOUND' : 'AUTH_ERROR', err.message);
      return;
    }
    next(error);
  }
}

export async function listAppointmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const appointments = await customerAppointmentService.listCustomerAppointments(req.customer.id);
    sendSuccess(res, 200, { appointments });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const appointmentId = String(req.params.id);
    const appointment = await customerAppointmentService.getCustomerAppointment(req.customer.id, appointmentId);
    if (!appointment) {
      sendError(res, 404, 'NOT_FOUND', 'Appointment not found');
      return;
    }

    sendSuccess(res, 200, { appointment });
  } catch (error) {
    next(error);
  }
}

export async function cancelAppointmentController(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.customer) {
      sendError(res, 401, 'AUTH_ERROR', 'Authentication required');
      return;
    }

    const appointmentId = String(req.params.id);
    const appointment = await customerAppointmentService.cancelCustomerAppointment(req.customer.id, appointmentId);
    sendSuccess(res, 200, { appointment });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status === 400 || err.status === 404) {
      sendError(res, err.status, err.status === 404 ? 'NOT_FOUND' : 'CONFLICT', err.message);
      return;
    }
    next(error);
  }
}

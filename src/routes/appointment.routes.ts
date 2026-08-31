import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAppointmentController, getAppointmentController, listAppointmentsController, updateAppointmentStatusController } from '../controllers/appointment.controller.js';

export const appointmentRoutes = Router();

appointmentRoutes.use(requireAuth);
appointmentRoutes.post('/', createAppointmentController);
appointmentRoutes.get('/', requireRole('BUSINESS_ADMIN'), listAppointmentsController);
appointmentRoutes.get('/:id', requireRole('BUSINESS_ADMIN'), getAppointmentController);
appointmentRoutes.patch('/:id/status', requireRole('BUSINESS_ADMIN'), updateAppointmentStatusController);

import { Router } from 'express';
import { requireCustomerAuth } from '../middleware/auth.js';
import * as customerController from '../controllers/customer.controller.js';

export const customerRoutes = Router();

// Auth endpoints (public)
customerRoutes.post('/auth/signup', customerController.signupController);
customerRoutes.post('/auth/login', customerController.loginController);
customerRoutes.post('/auth/logout', customerController.logoutController);

// Me endpoint
customerRoutes.get('/auth/me', requireCustomerAuth, customerController.meController);

// Profile endpoints (requires auth)
customerRoutes.get('/profile', requireCustomerAuth, customerController.getProfileController);
customerRoutes.patch('/profile', requireCustomerAuth, customerController.updateProfileController);
customerRoutes.patch('/password', requireCustomerAuth, customerController.changePasswordController);

// Appointments endpoints
customerRoutes.get('/appointments', requireCustomerAuth, customerController.listAppointmentsController);
customerRoutes.get('/appointments/:id', requireCustomerAuth, customerController.getAppointmentController);
customerRoutes.patch('/appointments/:id/cancel', requireCustomerAuth, customerController.cancelAppointmentController);

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createBusinessController, getBusinessController, getBusinessProfileController, listBusinessesController, updateBusinessProfileController, updateBusinessStatusController } from '../controllers/business.controller.js';

export const businessRoutes = Router();

businessRoutes.use(requireAuth);

businessRoutes.get('/', requireRole('SYSTEM_OWNER'), listBusinessesController);
businessRoutes.post('/', requireRole('SYSTEM_OWNER'), createBusinessController);
businessRoutes.get('/:id', requireRole('SYSTEM_OWNER'), getBusinessController);
businessRoutes.patch('/:id/status', requireRole('SYSTEM_OWNER'), updateBusinessStatusController);

businessRoutes.get('/profile', requireRole('BUSINESS_ADMIN'), getBusinessProfileController);
businessRoutes.patch('/profile', requireRole('BUSINESS_ADMIN'), updateBusinessProfileController);

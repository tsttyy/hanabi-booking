import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createServiceController, deleteServiceController, getServiceController, listServicesController, updateServiceController } from '../controllers/service.controller.js';

export const serviceRoutes = Router();

serviceRoutes.use(requireAuth);
serviceRoutes.get('/', requireRole('BUSINESS_ADMIN', 'SYSTEM_OWNER'), listServicesController);
serviceRoutes.post('/', requireRole('BUSINESS_ADMIN'), createServiceController);
serviceRoutes.get('/:id', requireRole('BUSINESS_ADMIN', 'SYSTEM_OWNER'), getServiceController);
serviceRoutes.patch('/:id', requireRole('BUSINESS_ADMIN'), updateServiceController);
serviceRoutes.delete('/:id', requireRole('BUSINESS_ADMIN'), deleteServiceController);

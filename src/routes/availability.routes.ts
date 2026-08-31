import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createAvailabilityController, deleteAvailabilityController, listAvailabilityController, updateAvailabilityController } from '../controllers/availability.controller.js';

export const availabilityRoutes = Router();

availabilityRoutes.use(requireAuth);
availabilityRoutes.get('/', requireRole('BUSINESS_ADMIN'), listAvailabilityController);
availabilityRoutes.post('/', requireRole('BUSINESS_ADMIN'), createAvailabilityController);
availabilityRoutes.patch('/:id', requireRole('BUSINESS_ADMIN'), updateAvailabilityController);
availabilityRoutes.delete('/:id', requireRole('BUSINESS_ADMIN'), deleteAvailabilityController);

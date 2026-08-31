import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createStaffController, deleteStaffController, getStaffController, listStaffController, updateStaffController } from '../controllers/staff.controller.js';

export const staffRoutes = Router();

staffRoutes.use(requireAuth);
staffRoutes.get('/', requireRole('BUSINESS_ADMIN'), listStaffController);
staffRoutes.post('/', requireRole('BUSINESS_ADMIN'), createStaffController);
staffRoutes.get('/:id', requireRole('BUSINESS_ADMIN'), getStaffController);
staffRoutes.patch('/:id', requireRole('BUSINESS_ADMIN'), updateStaffController);
staffRoutes.delete('/:id', requireRole('BUSINESS_ADMIN'), deleteStaffController);

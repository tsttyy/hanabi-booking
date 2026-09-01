import { Router } from 'express';
import { getPublicBusinessController, getPublicServicesController, getPublicStaffController, getPublicSlotsController } from '../controllers/public.controller.js';

export const publicRoutes = Router();

publicRoutes.get('/businesses/:businessId', getPublicBusinessController);
publicRoutes.get('/businesses/:businessId/services', getPublicServicesController);
publicRoutes.get('/businesses/:businessId/staff', getPublicStaffController);
publicRoutes.get('/businesses/:businessId/services/:serviceId/slots', getPublicSlotsController);

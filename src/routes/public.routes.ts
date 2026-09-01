import { Router } from 'express';
import { listPublicBusinessesController, getPublicBusinessController, getPublicServicesController, getPublicStaffController, getPublicSlotsController, lookupPublicBookingController, cancelPublicBookingController } from '../controllers/public.controller.js';

export const publicRoutes = Router();

publicRoutes.get('/businesses', listPublicBusinessesController);
publicRoutes.get('/businesses/:businessId', getPublicBusinessController);
publicRoutes.get('/businesses/:businessId/services', getPublicServicesController);
publicRoutes.get('/businesses/:businessId/staff', getPublicStaffController);
publicRoutes.get('/businesses/:businessId/services/:serviceId/slots', getPublicSlotsController);
publicRoutes.get('/bookings', lookupPublicBookingController);
publicRoutes.post('/bookings/cancel', cancelPublicBookingController);

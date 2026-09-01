import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/auth.routes.js';
import { businessRoutes } from './routes/business.routes.js';
import { serviceRoutes } from './routes/service.routes.js';
import { staffRoutes } from './routes/staff.routes.js';
import { availabilityRoutes } from './routes/availability.routes.js';
import { appointmentRoutes } from './routes/appointment.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { customerRoutes } from './routes/customer.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ success: true, status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/customer', customerRoutes);
  app.use('/api/businesses', businessRoutes);
  app.use('/api/business', businessRoutes);
  app.use('/api/services', serviceRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/availability', availabilityRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/public', publicRoutes);

  app.use(errorHandler);

  return app;
}

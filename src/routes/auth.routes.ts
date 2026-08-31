import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loginController, logoutController, meController } from '../controllers/auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', loginController);
authRoutes.post('/logout', logoutController);
authRoutes.get('/me', requireAuth, meController);

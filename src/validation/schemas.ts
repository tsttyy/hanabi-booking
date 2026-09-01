import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password is required'),
});

export const customerSignupSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().min(7, 'Valid phone number required').optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().trim().email('Invalid email format'),
  password: z.string().min(8, 'Password is required'),
});

export const customerProfileUpdateSchema = z.object({
  name: z.string().min(2, 'Name is required').optional(),
  phone: z.string().min(7, 'Valid phone number required').nullable().optional(),
});

export const customerPasswordChangeSchema = z.object({
  currentPassword: z.string().min(8, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const businessCreateSchema = z.object({
  name: z.string().min(2, 'Business name is required'),
  contactEmail: z.string().trim().email('Invalid contact email'),
  contactPhone: z.string().min(7, 'Phone number is required'),
  timezone: z.string().min(2, 'Timezone is required'),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  adminName: z.string().min(2, 'Admin name is required'),
  adminEmail: z.string().trim().email('Invalid admin email'),
  adminPassword: z.string().min(8, 'Admin password must be at least 8 characters'),
});

export const businessStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const serviceSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive('Duration must be greater than 0'),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export const staffSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().trim().email('Valid email required'),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export const availabilitySchema = z.object({
  staffId: z.string().uuid().nullable().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export const appointmentCreateSchema = z.object({
  businessId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  customerName: z.string().min(1, 'Customer name required'),
  customerEmail: z.string().trim().email('Valid customer email required'),
  customerPhone: z.string().min(7, 'Customer phone required'),
  startAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)),
  timezone: z.string().optional(),
});

export const appointmentStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
